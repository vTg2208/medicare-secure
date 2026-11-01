// EMR API Integration
import apiClient from './client';

export const emrApi = {
    // Medical Records & Consultation
    createMedicalRecord: async (data) => {
        const response = await apiClient.post('/emr/medical-records', data);
        return response.data;
    },

    getMedicalRecord: async (recordId, params = {}) => {
        const response = await apiClient.get(`/emr/medical-records/${recordId}`, { params });
        return response.data;
    },

    getPatientMedicalRecords: async (patientId, params = {}) => {
        const response = await apiClient.get(`/emr/patients/${patientId}/medical-records`, { params });
        return response.data;
    },

    // Diagnosis
    createDiagnosis: async (data) => {
        const response = await apiClient.post('/emr/diagnoses', data);
        return response.data;
    },

    createDiagnosisAddendum: async (diagnosisId, data) => {
        const response = await apiClient.post(`/emr/diagnoses/${diagnosisId}/addendum`, data);
        return response.data;
    },

    updateDiagnosisStatus: async (diagnosisId, status) => {
        const response = await apiClient.patch(`/emr/diagnoses/${diagnosisId}/status`, { status });
        return response.data;
    },

    getVisitDiagnoses: async (visitId) => {
        const response = await apiClient.get(`/emr/visits/${visitId}/diagnoses`);
        return response.data;
    },

    // Prescription
    createPrescription: async (data) => {
        const response = await apiClient.post('/emr/prescriptions', data);
        return response.data;
    },

    checkDrugInteractions: async (data) => {
        const response = await apiClient.post('/emr/prescriptions/check-interactions', data);
        return response.data;
    },

    updatePrescriptionStatus: async (prescriptionId, status) => {
        const response = await apiClient.patch(`/emr/prescriptions/${prescriptionId}/status`, { status });
        return response.data;
    },

    getVisitPrescriptions: async (visitId) => {
        const response = await apiClient.get(`/emr/visits/${visitId}/prescriptions`);
        return response.data;
    },

    // Lab Results & Orders
    createLabOrder: async (data) => {
        const response = await apiClient.post('/emr/lab-orders', data);
        return response.data;
    },

    getVisitLabOrders: async (visitId) => {
        const response = await apiClient.get(`/emr/visits/${visitId}/lab-orders`);
        return response.data;
    },

    uploadLabResult: async (formData) => {
        const response = await apiClient.post('/emr/lab-results', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    // Imaging Reports & Orders
    createImagingOrder: async (data) => {
        const response = await apiClient.post('/emr/imaging-orders', data);
        return response.data;
    },

    getVisitImagingOrders: async (visitId) => {
        const response = await apiClient.get(`/emr/visits/${visitId}/imaging-orders`);
        return response.data;
    },

    uploadImagingReport: async (formData) => {
        const response = await apiClient.post('/emr/imaging-reports', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    // Radiologist Queue
    getMyImagingOrders: async (params = {}) => {
        const response = await apiClient.get('/emr/my-imaging-orders', { params });
        return response.data;
    },
};


