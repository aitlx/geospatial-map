<<<<<<< HEAD
import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
=======
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
>>>>>>> restore-fri-sat
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
	ClipboardCheck,
	Eye,
	EyeOff,
	HelpCircle,
	Lock,
	LogIn,
	Mail,
	Map,
} from "lucide-react";
import { getPathForView } from "../utils/viewRoutes.js";
import { API_URL } from "../api";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
	const [checkingSession, setCheckingSession] = useState(true);

	const navigate = useNavigate();
	const location = useLocation();

<<<<<<< HEAD
		// api instance provides baseURL and withCredentials
=======
	const API_BASE_URL = useMemo(() => API_URL, []);
>>>>>>> restore-fri-sat

	const extractRoleId = useCallback((candidate) => {
		if (!candidate || typeof candidate !== "object") return null;
		const rawRole =
			candidate.roleID ??
			candidate.roleid ??
			candidate.role_id ??
			candidate.role;
		const numericRole =
			typeof rawRole === "string" ? Number.parseInt(rawRole, 10) : rawRole;
		return Number.isFinite(numericRole) ? numericRole : null;
	}, []);

	const resolveDestination = useCallback((roleId) => {
		if (!Number.isFinite(roleId)) return null;
		if (roleId === 1 || roleId === 2) return "/admin/dashboard";
		if (roleId === 3) return getPathForView("dashboard") || "/Dashboard";
		return "/";
	}, []);

	useEffect(() => {
		let isMounted = true;
		let redirected = false;

			const redirectIfAuthenticated = (roleId) => {
				const target = resolveDestination(roleId);
				if (target) {
					redirected = true;
					navigate(target, { replace: true });
				}
			};

		const checkLocalSession = () => {
			if (typeof window === "undefined") return null;
			try {
				const cached = window.localStorage.getItem("user");
				if (!cached) return null;
				const parsed = JSON.parse(cached);
				return extractRoleId(parsed);
					} catch {
				return null;
			}
		};

				// if we arrived here via an explicit logout navigation, do not auto-redirect
				// based on cached localStorage. This prevents a logout -> login -> redirect loop.
				const navStateReason = location?.state?.reason ?? null
				if (navStateReason === 'logout') {
					setCheckingSession(false)
				} else {
				const localRole = checkLocalSession();
				// only consider numeric role ids valid for auto-redirect
				if (Number.isFinite(localRole)) {
					redirectIfAuthenticated(localRole);
					if (isMounted && !redirected) {
						setCheckingSession(false);
					}
					return () => {
						isMounted = false;
					};
				}
			}

				const verifyRemoteSession = async () => {
					try {
						const response = await api.get(`/user/me`);
						if (!isMounted) return;
						const roleId = extractRoleId(response.data?.data);
						if (roleId !== null) {
							redirectIfAuthenticated(roleId);
							return;
						}
					} catch {
						// ignore remote session verification errors
					} finally {
						if (isMounted && !redirected) {
							setCheckingSession(false);
						}
					}
				};

		verifyRemoteSession();

		return () => {
			isMounted = false;
		};
<<<<<<< HEAD
		}, [extractRoleId, navigate, resolveDestination]);
=======
	}, [API_BASE_URL, extractRoleId, navigate, resolveDestination, location]);
>>>>>>> restore-fri-sat

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const loginUser = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
			const response = await api.post(`/auth/login`, formData);
			toast.success(response.data.message || "Login successful!");
			if (typeof window !== "undefined") {
				window.dispatchEvent(new Event("auth:login"));
			}
			setTimeout(() => {
				navigate(getPathForView("dashboard") || "/Dashboard");
			}, 1500);
    } catch (error) {
			const parseApiError = (err) => {
				if (!err) return "An unexpected error occurred.";
				if (err.response) {
					const d = err.response.data;
					if (typeof d === "string") return d;
					return d?.message || d?.err || d?.error || JSON.stringify(d) || err.message;
				}
				if (err.request) return "No response from server. Check your network.";
				return err.message || "An unexpected error occurred.";
			};

			toast.error(parseApiError(error));
    } finally {
      setIsLoading(false);
    }
  };

	if (checkingSession) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-950">
				<div className="flex flex-col items-center gap-3 text-emerald-200">
					<div
						className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent"
						aria-hidden="true"
					/>
					<p className="text-sm font-medium">Redirecting…</p>
				</div>
			</div>
		);
	}

	return (
		<div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4 py-6">
			<ToastContainer
				position="top-right"
				autoClose={3000}
				newestOnTop
				closeOnClick
				pauseOnHover
			/>

	<header className="absolute top-4 left-1/2 z-20 w-full max-w-[340px] -translate-x-1/2 px-4">
				<div className="flex items-center justify-center rounded-xl border border-emerald-200/60 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 shadow-sm backdrop-blur">
					<span>GeoAgriTech</span>
				</div>
			</header>

			<div className="relative z-10 mx-auto w-full max-w-[340px]">
				<section className="relative flex flex-col gap-4 rounded-3xl border border-emerald-100 bg-white/95 px-5 py-6 text-slate-900 shadow-xl backdrop-blur">
					<div className="relative z-10 flex flex-col gap-4">
						<div className="space-y-2">
							<div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-teal-700">
								<Map className="h-3 w-3" /> Technician portal
							</div>
							<div>
								<h2 className="text-lg font-semibold text-slate-900">Update barangay records</h2>
								<p className="mt-0.5 text-xs text-slate-500">Technicians only.</p>
							</div>
						</div>

						<div className="flex items-start gap-2.5 rounded-xl border border-teal-100 bg-teal-50/70 px-3 py-2.5 text-xs text-teal-700">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-700">
								<ClipboardCheck className="h-3.5 w-3.5" />
							</div>
							<p className="leading-snug">Use your registered technician credentials.</p>
						</div>

						<form onSubmit={loginUser} className="flex flex-col gap-4">
							<div className="space-y-1.5">
								<label htmlFor="email" className="text-xs font-medium text-slate-700">
									Email address
								</label>
								<div className="flex items-center gap-2.5 rounded-xl border border-teal-100 bg-teal-50/70 px-3 py-2 shadow-sm transition focus-within:border-teal-400 focus-within:bg-white focus-within:shadow-md">
									<Mail className="h-4 w-4 text-teal-500" />
									<input
										id="email"
										type="email"
										name="email"
										value={formData.email}
										onChange={handleChange}
										placeholder="technician@geoagritech.com"
										className="flex-1 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
										required
										autoComplete="email"
									/>
								</div>
							</div>

							<div className="space-y-1.5">
								<label htmlFor="password" className="text-xs font-medium text-slate-700">
									Password
								</label>
								<div className="flex items-center gap-2.5 rounded-xl border border-teal-100 bg-teal-50/70 px-3 py-2 shadow-sm transition focus-within:border-teal-400 focus-within:bg-white focus-within:shadow-md">
									<Lock className="h-4 w-4 text-teal-500" />
									<input
										id="password"
										type={showPassword ? "text" : "password"}
										name="password"
										value={formData.password}
										onChange={handleChange}
										placeholder="Enter your password"
										className="flex-1 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
										required
										autoComplete="current-password"
									/>
									<button
										type="button"
										onClick={() => setShowPassword((prev) => !prev)}
										className="flex h-6 w-6 items-center justify-center rounded-full text-teal-500 transition hover:bg-teal-50"
										aria-label={showPassword ? "Hide password" : "Show password"}
									>
										{showPassword ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
									</button>
								</div>
							</div>

							<button
								type="submit"
								disabled={isLoading}
								className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 via-teal-600 to-teal-500 text-xs font-semibold text-white shadow-lg shadow-teal-200 transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
							>
								{isLoading ? (
									<>
										<span className="loading loading-spinner loading-sm" />
										Logging in…
									</>
								) : (
									<>
										<LogIn className="h-3.5 w-3.5" />
										Log in
									</>
								)}
							</button>
						</form>

						<div className="space-y-1.5 text-[11px] text-slate-500">
							<p>Need access? Contact your municipal administrator.</p>
							<Link to="/forgot-password" state={{ portal: 'technician' }} className="font-semibold text-teal-600 transition hover:text-teal-700">Forgot password?</Link>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
