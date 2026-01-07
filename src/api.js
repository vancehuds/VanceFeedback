import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api'
});

let publicKey = null;

export const setPublicKey = (key) => {
    console.log('[Encryption] Public key set');
    publicKey = key;
};

// Helper to convert PEM to ArrayBuffer
function pemToArrayBuffer(pem) {
    const b64Lines = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const b64 = atob(b64Lines);
    const buf = new ArrayBuffer(b64.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < b64.length; i++) {
        view[i] = b64.charCodeAt(i);
    }
    return buf;
}

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export const encryptPayload = async (data) => {
    if (!publicKey) {
        console.error("[Encryption] Public key not set! Encryption skipped.");
        return null;
    }
    try {
        const keyBuffer = pemToArrayBuffer(publicKey);
        const importedKey = await window.crypto.subtle.importKey(
            "spki",
            keyBuffer,
            {
                name: "RSA-OAEP",
                hash: { name: "SHA-1" } // Standard for node-rsa compatibility usually
            },
            false,
            ["encrypt"]
        );

        const encoder = new TextEncoder();
        const encodedData = encoder.encode(JSON.stringify(data));

        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: "RSA-OAEP"
            },
            importedKey,
            encodedData
        );

        return arrayBufferToBase64(encrypted);
    } catch (e) {
        console.error("[Encryption] Encryption error:", e);
        return null;
    }
};

// Add Auth Token Interceptor
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor for token expiration
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response) {
            // Handle Rate Limiting
            if (error.response.status === 429) {
                if (!window.location.pathname.includes('/verify-human')) {
                    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                    sessionStorage.setItem('rateLimitReturnTo', returnTo);
                    // Redirect to verification page
                    window.location.href = '/verify-human';
                }
                return Promise.reject(error);
            }

            // Handle Auth Error
            if (error.response.status === 401) {
                if (!window.location.pathname.includes('/login')) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    alert('登录已过期，请重新登录');
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
