const PURPOSES = ['treatment','research','insurance','ai','messaging','all'];
const purposeForCategory = category => ['billing','insurance_claim'].includes(category) ? 'insurance' : 'treatment';
const processingAllowedSql = (patient, purpose) => {
    if (!PURPOSES.includes(purpose)) throw new Error('Unsupported processing purpose');
    return `NOT EXISTS (SELECT 1 FROM patient_processing_controls processing_control WHERE processing_control.patient_id=${patient}
        AND processing_control.purpose IN ('all','${purpose}') AND processing_control.released_at IS NULL)`;
};
module.exports = { PURPOSES, purposeForCategory, processingAllowedSql };
