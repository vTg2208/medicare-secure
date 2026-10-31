const sensitive = /password|secret|token|otp|govt|aadhaar|authorization|cookie|diagnos|symptom|clinical|description|notes|conversation|summary|address|phone|email|blood|insurance|date.?of.?birth|prescri|medicat|complaint|message|reason|payload|public.?key|credential/i;
const redactSensitive = (value, depth = 0) => {
    if (depth > 10) return '[REDACTED]';
    if (Array.isArray(value)) return value.map(item => redactSensitive(item, depth + 1));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
        [key, sensitive.test(key) ? '[REDACTED]' : redactSensitive(item, depth + 1)]));
};
module.exports = { redactSensitive };
