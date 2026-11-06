import axios from 'axios';

// Detect base URL based on environment and protocol
const getBaseURL = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    // For Capacitor/Mobile, we should check if we are in a native environment
    const isNative = window.location.protocol === 'capacitor:';
    if (isNative) {
        // Fallback to a default remote IP if not specified (User can change this in settings)
        return localStorage.getItem('remote_api_url') || 'http://YOUR_SERVER_IP:5005/api';
    }
    if (window.location.protocol === 'file:') return 'http://127.0.0.1:5005/api';
    return '/api';
};

const api = axios.create({
    baseURL: getBaseURL(),
    withCredentials: true
});

console.log('API Base URL:', api.defaults.baseURL);

export default api;
