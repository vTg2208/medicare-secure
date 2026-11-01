/**
 * Drug Database - In-memory reference catalog
 * For production, integrate with FDA API, RxNorm, or commercial drug database
 */

const drugDatabase = {
    // Common medications with their generic names and interactions
    medications: [
        {
            name: 'Warfarin',
            genericName: 'warfarin',
            drugCode: 'RX001',
            category: 'anticoagulant',
            interactions: ['aspirin', 'ibuprofen', 'naproxen', 'vitamin_k'],
            contraindications: ['pregnancy', 'bleeding_disorders']
        },
        {
            name: 'Aspirin',
            genericName: 'acetylsalicylic acid',
            drugCode: 'RX002',
            category: 'nsaid',
            interactions: ['warfarin', 'ibuprofen', 'naproxen', 'clopidogrel'],
            contraindications: ['bleeding_disorders', 'peptic_ulcer']
        },
        {
            name: 'Ibuprofen',
            genericName: 'ibuprofen',
            drugCode: 'RX003',
            category: 'nsaid',
            interactions: ['warfarin', 'aspirin', 'lisinopril', 'furosemide'],
            contraindications: ['kidney_disease', 'heart_failure']
        },
        {
            name: 'Lisinopril',
            genericName: 'lisinopril',
            drugCode: 'RX004',
            category: 'ace_inhibitor',
            interactions: ['ibuprofen', 'potassium_supplements', 'spironolactone'],
            contraindications: ['pregnancy', 'angioedema']
        },
        {
            name: 'Metformin',
            genericName: 'metformin',
            drugCode: 'RX005',
            category: 'antidiabetic',
            interactions: ['alcohol', 'contrast_dye'],
            contraindications: ['kidney_disease', 'liver_disease', 'heart_failure']
        },
        {
            name: 'Amoxicillin',
            genericName: 'amoxicillin',
            drugCode: 'RX006',
            category: 'antibiotic',
            interactions: ['methotrexate', 'oral_contraceptives'],
            contraindications: ['penicillin_allergy']
        },
        {
            name: 'Simvastatin',
            genericName: 'simvastatin',
            drugCode: 'RX007',
            category: 'statin',
            interactions: ['grapefruit', 'cyclosporine', 'gemfibrozil', 'amiodarone'],
            contraindications: ['pregnancy', 'liver_disease']
        },
        {
            name: 'Levothyroxine',
            genericName: 'levothyroxine',
            drugCode: 'RX008',
            category: 'thyroid_hormone',
            interactions: ['calcium', 'iron', 'antacids', 'soy'],
            contraindications: ['thyrotoxicosis']
        },
        {
            name: 'Omeprazole',
            genericName: 'omeprazole',
            drugCode: 'RX009',
            category: 'proton_pump_inhibitor',
            interactions: ['clopidogrel', 'warfarin', 'methotrexate'],
            contraindications: []
        },
        {
            name: 'Clopidogrel',
            genericName: 'clopidogrel',
            drugCode: 'RX010',
            category: 'antiplatelet',
            interactions: ['omeprazole', 'warfarin', 'aspirin', 'nsaids'],
            contraindications: ['active_bleeding']
        }
    ],

    // Drug-drug interaction rules with severity
    interactionRules: [
        {
            drug1: 'warfarin',
            drug2: 'aspirin',
            severity: 'high',
            description: 'Increased risk of bleeding',
            recommendation: 'Monitor INR closely. Consider alternative pain management.'
        },
        {
            drug1: 'warfarin',
            drug2: 'ibuprofen',
            severity: 'high',
            description: 'Increased risk of bleeding and reduced anticoagulant effect',
            recommendation: 'Avoid combination. Use acetaminophen for pain instead.'
        },
        {
            drug1: 'aspirin',
            drug2: 'ibuprofen',
            severity: 'moderate',
            description: 'Reduced cardioprotective effect of aspirin',
            recommendation: 'Take aspirin at least 2 hours before ibuprofen.'
        },
        {
            drug1: 'lisinopril',
            drug2: 'ibuprofen',
            severity: 'moderate',
            description: 'Reduced antihypertensive effect and increased risk of kidney damage',
            recommendation: 'Monitor blood pressure and kidney function.'
        },
        {
            drug1: 'simvastatin',
            drug2: 'amiodarone',
            severity: 'high',
            description: 'Increased risk of muscle damage (rhabdomyolysis)',
            recommendation: 'Do not exceed simvastatin 20mg daily.'
        },
        {
            drug1: 'clopidogrel',
            drug2: 'omeprazole',
            severity: 'moderate',
            description: 'Reduced antiplatelet effect of clopidogrel',
            recommendation: 'Consider alternative PPI (e.g., pantoprazole).'
        },
        {
            drug1: 'metformin',
            drug2: 'alcohol',
            severity: 'moderate',
            description: 'Increased risk of lactic acidosis',
            recommendation: 'Limit alcohol consumption.'
        }
    ],

    // Common allergies and cross-sensitivities
    allergyDatabase: [
        {
            allergen: 'penicillin',
            crossSensitivities: ['amoxicillin', 'ampicillin', 'cephalosporins'],
            alternatives: ['azithromycin', 'ciprofloxacin', 'levofloxacin']
        },
        {
            allergen: 'sulfa',
            crossSensitivities: ['sulfamethoxazole', 'sulfasalazine'],
            alternatives: ['doxycycline', 'ciprofloxacin']
        },
        {
            allergen: 'aspirin',
            crossSensitivities: ['nsaids', 'ibuprofen', 'naproxen'],
            alternatives: ['acetaminophen', 'celecoxib']
        }
    ]
};

/**
 * Find medication by name or generic name
 * @param {string} medicationName - Medication name
 * @returns {Object|null} Medication data
 */
function findMedication(medicationName) {
    const searchTerm = medicationName.toLowerCase().trim();
    return drugDatabase.medications.find(med =>
        med.name.toLowerCase() === searchTerm ||
        med.genericName.toLowerCase() === searchTerm
    );
}

/**
 * Search medications by partial name
 * @param {string} searchTerm - Search term
 * @returns {Array} Matching medications
 */
function searchMedications(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    return drugDatabase.medications.filter(med =>
        med.name.toLowerCase().includes(term) ||
        med.genericName.toLowerCase().includes(term)
    );
}

/**
 * Get all medications in a category
 * @param {string} category - Medication category
 * @returns {Array} Medications in category
 */
function getMedicationsByCategory(category) {
    return drugDatabase.medications.filter(med => med.category === category);
}

/**
 * Get interaction rules for a drug pair
 * @param {string} drug1 - First drug (generic name)
 * @param {string} drug2 - Second drug (generic name)
 * @returns {Object|null} Interaction rule
 */
function getInteractionRule(drug1, drug2) {
    const d1 = drug1.toLowerCase();
    const d2 = drug2.toLowerCase();

    return drugDatabase.interactionRules.find(rule =>
        (rule.drug1 === d1 && rule.drug2 === d2) ||
        (rule.drug1 === d2 && rule.drug2 === d1)
    );
}

/**
 * Get allergy information
 * @param {string} allergen - Allergen name
 * @returns {Object|null} Allergy data
 */
function getAllergyInfo(allergen) {
    return drugDatabase.allergyDatabase.find(allergy =>
        allergy.allergen.toLowerCase() === allergen.toLowerCase()
    );
}

module.exports = {
    drugDatabase,
    findMedication,
    searchMedications,
    getMedicationsByCategory,
    getInteractionRule,
    getAllergyInfo
};
