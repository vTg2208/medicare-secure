const DAY = 86400000;
const validDate = value => {
    const date = new Date(value);
    const parts = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/);
    if (!parts || Number.isNaN(date.getTime()) || Number(parts[2]) < 1 || Number(parts[2]) > 12 || Number(parts[3]) < 1 || Number(parts[3]) > new Date(Date.UTC(Number(parts[1]),Number(parts[2]),0)).getUTCDate()) {
        throw Object.assign(new Error('A valid discovery timestamp is required'), { statusCode: 400 });
    }
    return date;
};

// Reminder limits support a human assessment; they never authorize delaying a notice.
function breachObligations(assessment) {
    const discovered = validDate(assessment.discoveredAt);
    const day60 = new Date(discovered.getTime() + 60 * DAY).toISOString();
    const gdpr72 = new Date(discovered.getTime() + 3 * DAY).toISOString();
    const annual = new Date(Date.UTC(discovered.getUTCFullYear() + 1, 0, 1) + 59 * DAY).toISOString();
    const obligations = [];
    const add = (regime, audience, decision, dueAt, explanation) => obligations.push({ regime, audience, decision, dueAt, explanation });
    if (assessment.regimes.includes('gdpr')) {
        if (assessment.gdprRole === 'processor') {
            add('gdpr', 'controller', 'required', null, 'Notify the controller without undue delay. The controller assesses authority and individual notice.');
        } else {
            add('gdpr', 'authority', assessment.riskLevel === 'unknown' ? 'pending' : assessment.riskLevel === 'unlikely' ? 'not_required' : 'required', gdpr72,
                'Notify without undue delay and, where feasible, within 72 hours of awareness unless risk to individuals is unlikely. Document any delay.');
            add('gdpr', 'individual', assessment.riskLevel === 'high' ? 'required' : assessment.riskLevel === 'unknown' ? 'pending' : 'not_required', null,
                'High risk generally requires communication to affected individuals without undue delay; document any applicable exception.');
        }
    }
    if (assessment.regimes.includes('hipaa')) {
        const decision = assessment.hipaaDetermination === 'notifiable' ? 'required' : assessment.hipaaDetermination === 'not_notifiable' ? 'not_required' : 'pending';
        if (assessment.hipaaRole === 'business_associate') {
            add('hipaa', 'covered_entity', decision, day60, 'Notify the covered entity without unreasonable delay; 60 days is an outer limit, not a waiting period.');
        } else {
            add('hipaa', 'individual', decision, day60, 'A notifiable breach requires individual notice without unreasonable delay and no later than 60 days after discovery.');
            add('hipaa', 'secretary', decision, assessment.affectedCount !== null && assessment.affectedCount < 500 ? annual : day60,
                '500 or more affected individuals: no later than 60 days after discovery; fewer than 500: no later than 60 days after year-end. An unknown count uses the earlier reminder until assessed.');
            add('hipaa', 'media', decision === 'not_required' ? decision : assessment.mediaDecision === 'required' ? decision : assessment.mediaDecision === 'not_required' ? 'not_required' : 'pending', day60,
                'Assess whether more than 500 residents of a state or jurisdiction are affected. Overall affected count alone does not decide media notice.');
        }
    }
    return obligations;
}

function normalizeAssessment(body, now = new Date()) {
    const fail = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
    const discovered = validDate(body.discoveredAt);
    if (discovered > now) fail('Discovery cannot be in the future');
    if (!Array.isArray(body.regimes)) fail('Select GDPR and/or HIPAA');
    const regimes = [...new Set(body.regimes)];
    if (!regimes.length || regimes.some(value => !['gdpr', 'hipaa'].includes(value))) fail('Select GDPR and/or HIPAA');
    const choice = (name, allowed, fallback) => {
        const value = body[name] ?? fallback;
        if (!allowed.includes(value)) fail(`Invalid ${name}`);
        return value;
    };
    const text = (name, required = false) => {
        const value = typeof body[name] === 'string' ? body[name].trim() : '';
        if ((required && value.length < 10) || value.length > 4000) fail(`${name} must contain ${required ? '10–4000' : 'at most 4000'} characters`);
        return value;
    };
    const affectedCount = body.affectedCount === null || body.affectedCount === undefined || body.affectedCount === '' ? null : Number(body.affectedCount);
    if (affectedCount !== null && (!['string','number'].includes(typeof body.affectedCount) || !Number.isSafeInteger(affectedCount) || affectedCount < 0)) fail('Affected count must be a nonnegative whole number or unknown');
    const assessment = {
        discoveredAt: discovered.toISOString(), regimes, affectedCount,
        gdprRole: choice('gdprRole', ['controller', 'processor'], 'controller'),
        hipaaRole: choice('hipaaRole', ['covered_entity', 'business_associate'], 'covered_entity'),
        riskLevel: choice('riskLevel', ['unknown', 'unlikely', 'risk', 'high'], 'unknown'),
        hipaaDetermination: choice('hipaaDetermination', ['pending', 'notifiable', 'not_notifiable'], 'pending'),
        mediaDecision: choice('mediaDecision', ['pending', 'required', 'not_required'], 'pending'),
        facts: text('facts', true), consequences: text('consequences', true), measures: text('measures', true),
        contact: text('contact', true), rationale: text('rationale', true),
        hipaaFactors: text('hipaaFactors', regimes.includes('hipaa')),
    };
    return assessment;
}

function obligationStatus(obligation, attempts, now = new Date()) {
    if (obligation.decision === 'pending') return obligation.dueAt && new Date(obligation.dueAt) < now ? 'assessment_overdue' : 'assessment_pending';
    if (obligation.decision === 'not_required') return 'not_required';
    const sent = attempts.some(attempt => attempt.regime === obligation.regime && attempt.audience === obligation.audience && attempt.status === 'sent');
    if (sent) return 'recorded';
    if (obligation.dueAt && new Date(obligation.dueAt) < now) return 'overdue';
    return 'awaiting_notice';
}

module.exports = { breachObligations, normalizeAssessment, obligationStatus };
