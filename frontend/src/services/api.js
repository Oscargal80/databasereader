import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : 'https://api-db.binariaos.com.py/api'),
    withCredentials: true // Important for sessions
});

console.log('API Base URL:', api.defaults.baseURL);

export default api;
