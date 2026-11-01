import client from './client';
export const privacyApi = {
    requests: async () => (await client.get('/privacy/requests')).data.data,
    review: async () => (await client.get('/privacy/review')).data.data,
    submit: async body => (await client.post('/privacy/requests', body)).data.data,
    update: async (id, body) => (await client.put(`/privacy/requests/${id}`, body)).data.data,
    exportData: async currentPassword => (await client.post('/privacy/export', { currentPassword }, { timeout: 120000 })).data.data,
};
