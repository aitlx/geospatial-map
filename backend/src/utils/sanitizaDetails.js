import { cleanseVulgarValue } from "./sanitizeVulgarity.js";

const FORBIDDEN_KEYS = new Set(["password", "confirmPassword", "newPassword", "oldPassword", "token"]);

const removeForbiddenKeys = (value) => {
    if (!value || typeof value !== "object" || value instanceof Date) {
        return value;
    }

    if (Array.isArray(value)) {
        return value
            .map((item) => removeForbiddenKeys(item))
            .filter((item) => item !== null && item !== undefined && item !== "");
    }

    return Object.entries(value).reduce((acc, [key, val]) => {
        if (FORBIDDEN_KEYS.has(key)) {
            return acc;
        }

        const cleaned = removeForbiddenKeys(val);
        if (cleaned !== null && cleaned !== undefined && cleaned !== "") {
            acc[key] = cleaned;
        }
        return acc;
    }, {});
};

export const sanitizaDetails = (data) => {
    if (data === null || data === undefined) {
        return null;
    }

    const cleansed = cleanseVulgarValue(data);

    if (typeof cleansed === "string") {
        const trimmed = cleansed.trim();
        return trimmed.length ? trimmed : null;
    }

    if (Array.isArray(cleansed)) {
        const sanitizedArray = cleansed
            .map((item) => sanitizaDetails(item))
            .filter((item) => item !== null);
        return sanitizedArray.length ? sanitizedArray : null;
    }

    if (typeof cleansed === "object") {
        const withoutForbidden = removeForbiddenKeys(cleansed);
        const entries = Object.entries(withoutForbidden);
        if (!entries.length) {
            return null;
        }
        return entries.reduce((acc, [key, val]) => {
            const nested = sanitizaDetails(val);
            if (nested !== null) {
                acc[key] = nested;
            }
            return acc;
        }, {});
    }

    return cleansed;
};