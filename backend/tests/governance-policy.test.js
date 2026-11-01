const { test } = require('node:test');
const assert = require('node:assert/strict');
const { breachObligations, normalizeAssessment, obligationStatus } = require('../src/modules/compliance/breach.policy');
const fixture = extra => ({ discoveredAt: '2026-01-01T10:00:00Z', regimes: ['gdpr','hipaa'], affectedCount: 500,
    facts: 'Synthetic incident facts', consequences: 'Synthetic consequences', measures: 'Synthetic containment measures',
    contact: 'Privacy response office', rationale: 'Synthetic assessment rationale', hipaaFactors: 'Nature, recipient, acquisition and mitigation reviewed', ...extra });
test('risk-sensitive GDPR reminders use actual awareness plus72h and high risk individual notice', () => {
    const obligations = breachObligations(normalizeAssessment(fixture({ riskLevel: 'high' })));
    assert.equal(obligations.find(o=>o.regime==='gdpr'&&o.audience==='authority').dueAt, '2026-01-04T10:00:00.000Z');
    assert.equal(obligations.find(o=>o.regime==='gdpr'&&o.audience==='individual').decision, 'required');
});
test('HIPAA secretary count boundary and annual deadline include leap years', () => {
    for (const [year,count,expected] of [[2026,499,'2027-03-01T00:00:00.000Z'],[2027,499,'2028-02-29T00:00:00.000Z'],[2026,500,'2026-03-02T10:00:00.000Z']]) {
        const a=normalizeAssessment(fixture({discoveredAt:`${year}-01-01T10:00:00Z`,affectedCount:count}), new Date('2028-01-01'));
        assert.equal(breachObligations(a).find(o=>o.audience==='secretary').dueAt,expected);
    }
});
test('processor/business-associate duties and state-specific media decisions are modeled separately', () => {
    const a=normalizeAssessment(fixture({gdprRole:'processor',hipaaRole:'business_associate'}));
    assert.deepEqual(breachObligations(a).map(o=>o.audience),['controller','covered_entity']);
    const covered=breachObligations(normalizeAssessment(fixture({affectedCount:2000,mediaDecision:'pending'})));
    assert.equal(covered.find(o=>o.audience==='media').decision,'pending');
});
test('unknown assessment stays open; failed delivery never satisfies an obligation', () => {
    const o=breachObligations(normalizeAssessment(fixture())).find(o=>o.regime==='gdpr'&&o.audience==='authority');
    assert.equal(obligationStatus(o,[],new Date('2026-01-02')),'assessment_pending');
    assert.equal(obligationStatus(o,[{...o,status:'failed'}],new Date('2026-01-05')),'assessment_overdue');
    assert.equal(obligationStatus(o,[{...o,status:'sent'}],new Date('2026-01-05')),'assessment_overdue');
});
test('invalid or future discovery and incomplete risk rationale are rejected', () => {
    assert.throws(()=>normalizeAssessment(fixture({discoveredAt:'bad'})),/valid discovery/);
    assert.throws(()=>normalizeAssessment(fixture({discoveredAt:'2100-01-01T00:00:00Z'})),/future/);
    assert.throws(()=>normalizeAssessment(fixture({rationale:'no'})),/rationale/);
    assert.throws(()=>normalizeAssessment(fixture({affectedCount:-1})),/Affected count/);
});
