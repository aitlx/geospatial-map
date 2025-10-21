import axios from "axios";

// api. set VITE_API_URL / VITE_ASSET_URL at build time.
const env = String(import.meta.env.VITE_API_URL || '').trim();
const assetEnv = String(import.meta.env.VITE_ASSET_URL || '/assets').trim();

const stripSlash = (s) => s.replace(/\/+$/, '');

let API_BASE_URL = '/api';
if (env) {
    const cleaned = env.startsWith('http') ? stripSlash(env) : '/' + stripSlash(env);
    API_BASE_URL = cleaned.endsWith('/api') ? cleaned : cleaned + '/api';
}

const ASSET_BASE_URL = stripSlash(assetEnv) || '/assets';

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // send cookies
    timeout: 15000,
});

export default api
export { API_BASE_URL, ASSET_BASE_URL }
