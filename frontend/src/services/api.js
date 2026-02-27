import axios from 'axios';

// Detect base URL based on environment and protocol
const getBaseURL = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (window.location.protocol === 'file:') return 'http://127.0.0.1:5005/api';
    return '/api';
};

const api = axios.create({
    baseURL: getBaseURL(),
    withCredentials: true
});

console.log('API Base URL:', api.defaults.baseURL);

export default api;
