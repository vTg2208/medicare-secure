// Visit API Client - Epic 3: Visit Management
import apiClient from './client';

export const visitApi = {
    // Patient: Create a new visit (Request to join hospital)
    createVisit: async (visitData) => {
        const response = await apiClient.post('/visits/request', visitData);
        return response.data;
    },

    // Patient: Get my visits
    getMyVisits: async () => {
        const response = await apiClient.get('/visits/my-visits');
        const visits = response.data.data || [];


        // Transform snake_case backend data to camelCase for frontend
        return (Array.isArray(visits) ? visits : []).map(visit => ({
            ...visit,
            doctorName: (visit.doctor_first_name && visit.doctor_last_name)
                ? `${visit.doctor_first_name} ${visit.doctor_last_name}`
                : (visit.doctor_full_name || 'Unassigned'),
            nurseName: (visit.nurse_first_name && visit.nurse_last_name)
                ? `${visit.nurse_first_name} ${visit.nurse_last_name}`
                : (visit.nurse_full_name || null),
            patientName: (visit.patient_first_name && visit.patient_last_name)
                ? `${visit.patient_first_name} ${visit.patient_last_name}`
                : (visit.patient_full_name || null),
            scheduledTime: visit.scheduled_time,
            visitCode: visit.visit_code || visit.otp_code,
            visitType: visit.reason || visit.visit_type || visit.type,
            organizationName: visit.organization_name || visit.hospital_name
        }));
    },

    // Admin/Staff: Get hospital visits
    getHospitalVisits: async (status = null) => {
        const params = status ? { status } : {};
        const response = await apiClient.get('/visits/hospital', { params });
        return response.data;
    },

    // Doctor/Nurse: Get assigned/active visits
    getActiveVisits: async () => {
        const response = await apiClient.get('/visits/assigned');
        return response.data;
    },

    // Admin/Staff: Update visit (Assign staff, change status)
    updateVisit: async (visitId, updateData) => {
        const response = await apiClient.patch(`/visits/${visitId}/assign`, updateData);
        return response.data;
    },

    // Admin: Approve visit and assign doctor/nurse (generates OTP)
    approveVisit: async (visitId, doctorId, nurseId = null, scheduledTime = null) => {
        const response = await apiClient.post(`/visits/${visitId}/approve`, {
            doctorId,
            nurseId,
            scheduledTime
        });
        return response.data;
    },

    // Patient: Verify OTP with access level selection
    verifyVisitOTP: async (visitId, otp, accessLevel) => {
        const response = await apiClient.post(`/visits/${visitId}/verify-otp`, {
            otp,
            accessLevel
        });
        return response.data;
    },

    // Patient: Check in using visit code
    checkIn: async (visitCode) => {
        const response = await apiClient.post('/visits/check-in', { visitCode });
        return response.data;
    },

    // Admin/Doctor: Close visit (complete or cancel)
    closeVisit: async (visitId, status) => {
        const response = await apiClient.post(`/visits/${visitId}/close`, { status });
        return response.data;
    },

    // Admin/Doctor/Nurse: Get staff assigned to visit
    getVisitStaff: async (visitId) => {
        const response = await apiClient.get(`/visits/${visitId}/staff`);
        return response.data;
    },

    // Admin/Doctor: Assign additional staff to visit
    assignStaff: async (visitId, staffUserId, role) => {
        const response = await apiClient.post(`/visits/${visitId}/assign-staff`, {
            staffUserId,
            role
        });
        return response.data;
    },

    // Patient: Get Queue Status for a visit
    getQueueStatus: async (visitId) => {
        const response = await apiClient.get(`/visits/${visitId}/queue-status`);
        return response.data;
    },

    // Get staff by role (for assignment dropdowns)
    getStaffByRole: async (role) => {
        const response = await apiClient.get(`/visits/staff/${role}`);
        return response.data;
    },

    // Receptionist: Update the scheduled time for a visit
    updateScheduledTime: async (visitId, scheduledTime) => {
        const response = await apiClient.patch(`/visits/${visitId}/scheduled-time`, { scheduledTime });
        return response.data;
    }
};

export default visitApi;
