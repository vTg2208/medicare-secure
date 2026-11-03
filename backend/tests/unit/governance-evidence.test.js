const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
let root;
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-evidence-'));
    fs.mkdirSync(path.join(root, 'backend/tests'), { recursive: true });
    fs.writeFileSync(path.join(root, 'backend/guard.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(root, 'backend/tests/access.test.js'), "test('denies another patient', () => {});");
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const fixture = () => ({
    root,
    inventory: { schemaVersion: 1, tables: [{ name: 'patients', columns: ['id', 'name'], classification: 'identity', purposes: ['care'], ownerRole: 'operator', audience: ['patient'], applicationEncryption: 'none', encryptedColumns: [], providerEncryption: 'requires_provider_evidence', retention: 'Reviewed policy required; no automatic disposal.' }], stores: [{ id: 'backup', classification: 'clinical', purpose: 'Recovery', protection: 'Separate encrypted envelope', retention: 'Seven daily dates and three monthly periods', assurance: 'Owner key custody required' }] },
    controls: { schemaVersion: 1, controls: [{ id: 'ACCESS-01', principles: ['GDPR Article 32'], ownerRole: 'security_owner', implementation: { status: 'implemented', sources: ['backend/guard.js'], limitations: ['Endpoint compromise remains outside the guard.'] }, verification: { scenarios: [{ file: 'backend/tests/access.test.js', title: 'denies another patient' }], observations: [] }, externalRequirements: [{ id: 'workforce_review', status: 'pending', ownerRole: 'operator', evidence: [] }] }] },
});
const check = input => require('../../scripts/governance-evidence').checkEvidence(input);
test('reference checks do not assert operational compliance or test execution', () => {
    expect(check(fixture())).toEqual({ tables: 1, columns: 2, controls: 1, externalPending: 1, verification: 'references_checked_only' });
});
test('a missing implementation reference is an actionable validation failure', () => {
    const input = fixture(); input.controls.controls[0].implementation.sources = ['backend/missing.js'];
    expect(() => check(input)).toThrow(/missing.*backend\/missing.js/i);
});
test('a renamed or missing verification scenario cannot remain credited', () => {
    const input = fixture(); input.controls.controls[0].verification.scenarios[0].title = 'a test that does not exist';
    expect(() => check(input)).toThrow(/scenario/i);
});
test('external evidence cannot be reported as machine-verified', () => {
    const input = fixture(); input.controls.controls[0].externalRequirements[0].status = 'verified';
    expect(() => check(input)).toThrow(/external.*status/i);
});
test('an owner assertion needs retained evidence and attribution', () => {
    const input = fixture(); input.controls.controls[0].externalRequirements[0].status = 'owner_recorded';
    expect(() => check(input)).toThrow(/owner.*evidence/i);
});
test('unclassified retention and encrypted columns are rejected', () => {
    const input = fixture(); delete input.inventory.tables[0].retention;
    expect(() => check(input)).toThrow(/retention/i);
    input.inventory.tables[0].retention = 'Reviewed policy required'; input.inventory.tables[0].encryptedColumns = ['unknown'];
    expect(() => check(input)).toThrow(/encrypted.*column/i);
});
test('references cannot escape the repository through paths or links', () => {
    const input = fixture(); input.controls.controls[0].implementation.sources = ['../outside.js'];
    expect(() => check(input)).toThrow(/reference.*path/i);
    fs.symlinkSync(os.tmpdir(), path.join(root, 'outside'), process.platform === 'win32' ? 'junction' : 'dir');
    input.controls.controls[0].implementation.sources = ['outside/anything.js'];
    expect(() => check(input)).toThrow(/reference.*path/i);
});
test('column sensitivity overrides cannot silently describe nonexistent columns', () => {
    const input = fixture(); input.inventory.tables[0].columnOverrides = { unknown: { classification: 'security', protection: 'Token hash' } };
    expect(() => check(input)).toThrow(/override.*column/i);
});
