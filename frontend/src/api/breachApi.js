import apiClient from './client';
const data = async request => (await request).data.data;
export const breachApi = {
    list: page => data(apiClient.get('/compliance/breaches', { params: { page } })),
    get: id => data(apiClient.get(`/compliance/breaches/${id}`)),
    create: body => data(apiClient.post('/compliance/breaches',body)),
    assess: (id,body) => data(apiClient.put(`/compliance/breaches/${id}`,body)),
    record: (id,body) => data(apiClient.post(`/compliance/breaches/${id}/notifications`,body)),
    status: (id,status) => data(apiClient.put(`/compliance/incidents/${id}`,{status})),
};
