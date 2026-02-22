import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    withCredentials: true
});

console.log('API Base URL:', api.defaults.baseURL);

export default api;
