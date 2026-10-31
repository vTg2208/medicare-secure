import apiClient from './client';

export const labApi = {
    /**
     * GET /api/lab/orders
     * Fetches all pending/in-progress lab orders assigned to the lab
     */
    getAssignedLabTests: async () => {
        const response = await apiClient.get('/lab/orders');
        if (response.data.success) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to fetch assigned lab tests');
    },

    /**
     * GET /api/lab/orders/:id
     * Fetches full details for a specific lab order
     */
    getLabRequestDetails: async (id) => {
        const response = await apiClient.get(`/lab/orders/${id}`);
        if (response.data.success) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to fetch lab order details');
    },

    /**
     * POST /api/lab/upload
     * Uploads a result file and marks the lab order as completed
     * Expects FormData with: order_id, test_name, test_code, test_category, notes, file
     */
    uploadLabResult: async (formData) => {
        const response = await apiClient.post('/lab/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    /**
     * GET /api/lab/results
     * Fetches previously uploaded lab results (Test History)
     */
    getUploadedResults: async () => {
        const response = await apiClient.get('/lab/results');
        if (response.data.success) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to fetch uploaded results');
    },

    /**
     * GET /api/lab/stats
     * Fetches dashboard statistics for the lab technician
     */
    getStats: async () => {
        const response = await apiClient.get('/lab/stats');
        if (response.data.success) {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to fetch lab stats');
    }
};
