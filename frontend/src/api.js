// ...existing code...
const raw = import.meta.env.VITE_API_URL || '/api';

const normalizeApiUrl = (value) => {
    const v = String(value || '').trim();
    if (!v) return '/api';

    // If it already ends with /api or /api/, normalize and return
    if (v.match(/\/api\/?$/)) {
        return v.replace(/\/+$/, '');
    }

    // If it looks like an absolute URL (http(s)://...), append /api
    if (v.startsWith('http://') || v.startsWith('https://')) {
        return v.replace(/\/+$/, '') + '/api';
    }

    // Otherwise treat as relative path, ensure it starts with '/'
    const rel = v.startsWith('/') ? v.replace(/\/+$/, '') : '/' + v.replace(/\/+$/, '');
    return rel;
};

export const API_URL = normalizeApiUrl(raw);

// ...existing code...

// added asset base url export
const rawAsset = import.meta.env.VITE_ASSET_URL || '/assets';
const normalizeAssetUrl = (value) => {
    const v = String(value || '').trim();
    if (!v) return '/assets';
    return v.replace(/\/+$/, '');
};
export const ASSET_BASE_URL = normalizeAssetUrl(rawAsset);

export default {
    API_URL,
    ASSET_BASE_URL,
};