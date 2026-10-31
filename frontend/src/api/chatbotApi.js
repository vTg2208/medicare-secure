import api from './client';

export const startChatbotSession = async () => {
    const response = await api.post('/chatbot/start');
    return response.data;
};

export const sendChatbotMessage = async (session_id, message) => {
    const response = await api.post('/chatbot/message', { session_id, message });
    return response.data;
};

export const analyzeChatbotSession = async (session_id) => {
    const response = await api.post('/chatbot/analyze', { session_id });
    return response.data;
};

export const getChatbotSummary = async (session_id) => {
    const response = await api.get(`/chatbot/summary/${session_id}`);
    return response.data;
};

export const getAllChatbotSessions = async () => {
    const response = await api.get('/chatbot/sessions');
    return response.data;
};
