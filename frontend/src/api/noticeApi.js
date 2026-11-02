import client from './client';
export const noticeApi = {
    current: async () => (await client.get('/notices/current',{skipAuth:true})).data.data,
    version: async id => (await client.get(`/notices/versions/${encodeURIComponent(id)}`,{skipAuth:true})).data.data,
    publications: async before => (await client.get('/notices/versions',{params:before?{before}:undefined})).data.data,
    publish: async body => (await client.post('/notices/versions',body)).data.data,
    acknowledgements: async () => (await client.get('/notices/acknowledgements')).data.data,
    acknowledge: async versionId => (await client.post('/notices/acknowledgements',{versionId,acknowledged:true})).data.data,
};
