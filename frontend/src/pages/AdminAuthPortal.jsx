import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Eye, EyeOff, ShieldCheck, Lock, Mail, LogIn } from "lucide-react";
import { getPathForView } from "../utils/viewRoutes.js";

const ADMIN_ROLE_LABELS = {
	1: "superadmin",
	2: "admin",
};

const createFormState = () => ({
	email: "",
	password: "",
});

export default function AdminAuthPortal() {
	const navigate = useNavigate();
	const API_BASE_URL = useMemo(
		() => import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000/api",
		[]
	);

	const [form, setForm] = useState(createFormState);
	const [submitting, setSubmitting] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [checkingSession, setCheckingSession] = useState(true);

	const extractRoleId = useCallback((candidate) => {
		if (!candidate || typeof candidate !== "object") return null;
		const rawRole =
			candidate.roleID ??
			candidate.roleid ??
			candidate.role_id ??
			candidate.role;
		const numericRole = typeof rawRole === "string" ? Number.parseInt(rawRole, 10) : rawRole;
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

		const redirectIfNeeded = (roleId) => {
			const target = resolveDestination(roleId);
			if (target) {
				redirected = true;
				navigate(target, { replace: true });
			}
		};

		const checkLocal = () => {
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

		const localRole = checkLocal();
		if (localRole !== null) {
			redirectIfNeeded(localRole);
			if (isMounted && !redirected) {
				setCheckingSession(false);
			}
			return () => {
				isMounted = false;
			};
		}

		const verifySession = async () => {
			try {
				const response = await axios.get(`${API_BASE_URL}/user/me`, {
					withCredentials: true,
				});
				if (!isMounted) return;
				const roleId = extractRoleId(response.data?.data);
				if (roleId !== null) {
					redirectIfNeeded(roleId);
					return;
				}
					} catch {
						/* ignore admin session verification errors */
			} finally {
				if (isMounted && !redirected) {
					setCheckingSession(false);
				}
			}
		};

		verifySession();

		return () => {
			isMounted = false;
		};
	}, [API_BASE_URL, extractRoleId, navigate, resolveDestination]);

	const handleChange = (event) => {
		const { name, value } = event.target;
		setForm((prev) => ({ ...prev, [name]: value }));
	};

	const togglePassword = () => setShowPassword((prev) => !prev);

	const handleSubmit = async (event) => {
		event.preventDefault();
		if (submitting) return;

		const email = form.email.trim().toLowerCase();
		const password = form.password.trim();

		if (!email || !password) {
			toast.error("Please enter your email and password.");
			return;
		}

		setSubmitting(true);
		try {
			const response = await axios.post(
				`${API_BASE_URL}/auth/admin/login`,
				{ email, password },
				{ withCredentials: true }
			);

			const payload = response.data?.data;
			const user = payload?.user;

			if (!user || !ADMIN_ROLE_LABELS[user.roleID]) {
				throw new Error("Account lacks admin access.");
			}

			if (payload?.token) {
				localStorage.setItem("token", payload.token);
			}

			localStorage.setItem("user", JSON.stringify(user));

			toast.success("Welcome back, admin!");
			if (typeof window !== "undefined") {
				window.dispatchEvent(new Event("auth:login"));
			}
			setForm(createFormState());

			setTimeout(() => {
				navigate("/admin/dashboard", { replace: true });
			}, 600);
		} catch (error) {
			const message =
				error.response?.data?.message ||
				error.message ||
				"Unable to sign in right now.";
			toast.error(message);
		} finally {
			setSubmitting(false);
		}
	};

	if (checkingSession) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
				<div className="flex flex-col items-center gap-3 text-emerald-600">
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
						<div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
							<ShieldCheck className="h-3 w-3" /> Admin portal
						</div>
						<div>
							<h2 className="text-lg font-semibold text-slate-900">Sign in to manage GeoAgriTech</h2>
							<p className="mt-0.5 text-xs text-slate-500">Admins and superadmins only.</p>
						</div>
					</div>

					<div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 text-xs text-emerald-700">
						<div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
							<ShieldCheck className="h-3.5 w-3.5" />
						</div>
						<p className="leading-snug">Use your authorized admin credentials to continue.</p>
					</div>

					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<div className="space-y-1.5">
							<label htmlFor="email" className="text-xs font-medium text-slate-700">
								Email address
							</label>
							<div className="flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 shadow-sm transition focus-within:border-emerald-400 focus-within:bg-white focus-within:shadow-md">
								<Mail className="h-4 w-4 text-emerald-500" />
								<input
									id="email"
									name="email"
									type="email"
									placeholder="admin@geoagritech.com"
									value={form.email}
									onChange={handleChange}
									autoComplete="email"
									required
									disabled={submitting}
									className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<label htmlFor="password" className="text-xs font-medium text-slate-700">
								Password
							</label>
							<div className="flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 shadow-sm transition focus-within:border-emerald-400 focus-within:bg-white focus-within:shadow-md">
								<Lock className="h-4 w-4 text-emerald-500" />
								<input
									id="password"
									name="password"
									type={showPassword ? "text" : "password"}
									placeholder="Enter your password"
									value={form.password}
									onChange={handleChange}
									autoComplete="current-password"
									required
									disabled={submitting}
									className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
								/>
								<button
									type="button"
									onClick={togglePassword}
									className="flex h-6 w-6 items-center justify-center rounded-full text-emerald-500 transition hover:bg-emerald-50"
									aria-label={showPassword ? "Hide password" : "Show password"}
								>
									{showPassword ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
								</button>
							</div>
						</div>

						<button
							type="submit"
							disabled={submitting}
							className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-200 transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
						>
							{submitting ? (
								<>
									<span className="loading loading-spinner loading-sm" />
									Signing in…
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
						<p>Need the technician portal instead?</p>
						<Link to="/login" className="font-semibold text-emerald-600 transition hover:text-emerald-700">Go to technician sign-in</Link>
					</div>
				</div>
			</section>
		</div>
		</div>
	);
}
