import axios from "axios";

// compute base from vite env; fallback to '/api' for proxied dev
const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000/api";

// debug to confirm vite injected the env at startup
console.log("[api] VITE_API_URL:", API_BASE_URL);

const api = axios.create({
	baseURL: API_BASE_URL || "/api",
	withCredentials: true,
	timeout: 15000,
});

export default api;
export { API_BASE_URL };