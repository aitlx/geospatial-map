import { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import {
	Users,
	Plus,
	Search,
	RefreshCw,
	Edit2,
	Trash2,
	BadgeCheck,
	AlertCircle,
	Filter,
	Mail,
	KeyRound,
	Eye,
	EyeOff,
	Copy,
	Loader2,
	ShieldCheck,
	UserPlus,
	X,
} from "lucide-react"

const ROLE_IDS = Object.freeze({
	SUPERADMIN: 1,
	ADMIN: 2,
	TECHNICIAN: 3,
})

const ROLE_LABELS = Object.freeze({
	[ROLE_IDS.SUPERADMIN]: "Super Admin",
	[ROLE_IDS.ADMIN]: "Admin",
	[ROLE_IDS.TECHNICIAN]: "Technician",
})

const ROLE_SLUG_TO_ID = Object.freeze({
	superadmin: ROLE_IDS.SUPERADMIN,
	admin: ROLE_IDS.ADMIN,
	technician: ROLE_IDS.TECHNICIAN,
})

const STATUS_FILTERS = [
	{ id: "all", label: "All status" },
	{ id: "verified", label: "Verified" },
	{ id: "unverified", label: "Not verified" },
]

const GENDER_FILTERS = [
	{ id: "all", label: "All genders" },
	{ id: "male", label: "Male" },
	{ id: "female", label: "Female" },
]

const ROLE_FILTERS = [
	{ id: "all", label: "All roles" },
	{ id: "superadmin", label: ROLE_LABELS[ROLE_IDS.SUPERADMIN] },
	{ id: "admin", label: ROLE_LABELS[ROLE_IDS.ADMIN] },
	{ id: "technician", label: ROLE_LABELS[ROLE_IDS.TECHNICIAN] },
]

const SORT_OPTIONS = [
	{ id: "created-desc", label: "Newest registrants", sortBy: "createdAt", sortOrder: "desc" },
	{ id: "created-asc", label: "Oldest registrants", sortBy: "createdAt", sortOrder: "asc" },
	{ id: "name-asc", label: "Name A–Z", sortBy: "name", sortOrder: "asc" },
	{ id: "name-desc", label: "Name Z–A", sortBy: "name", sortOrder: "desc" },
]

const DEFAULT_SORT_ID = "created-desc"
const DEFAULT_PAGE_SIZE = 15

const DEFAULT_PAGINATION = {
	page: 1,
	pageSize: DEFAULT_PAGE_SIZE,
	total: 0,
	totalPages: 1,
	hasNextPage: false,
	hasPreviousPage: false,
}

const DEFAULT_SUMMARY = {
	verified: 0,
	unverified: 0,
	roleCounts: {},
}

const EMPTY_ROLE_STATS = {
	total: 0,
	verified: 0,
	unverified: 0,
}

const DEFAULT_PASSWORD_MODAL = {
	open: false,
	technician: null,
	loading: false,
	error: "",
	temporaryPassword: "",
	copied: false,
}

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
	dateStyle: "medium",
	timeStyle: "short",
})

const resolveStoredUser = () => {
	if (typeof window === "undefined") return null
	try {
		const raw = window.localStorage.getItem("user")
		if (!raw) return null
		return JSON.parse(raw)
		} catch {
		return null
	}
}

const composeFullName = (user) => {
	const first = user?.firstname?.trim() || ""
	const last = user?.lastname?.trim() || ""
	const full = `${first} ${last}`.trim()
	return full.length ? full : user?.email || "Unnamed user"
}

const formatDate = (value) => {
	if (!value) return "—"
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) {
		return String(value)
	}
	return dateFormatter.format(date)
}

const getRoleStats = (roleCounts, roleId) => {
	const payload = roleCounts?.[roleId] ?? roleCounts?.[String(roleId)] ?? null
	if (!payload || typeof payload !== "object") {
		return EMPTY_ROLE_STATS
	}

	const total = Number(payload.total ?? payload.count ?? 0)
	const verified = Number(payload.verified ?? payload.verified_count ?? 0)
	const unverified = Number(payload.unverified ?? payload.unverified_count ?? 0)

	return {
		total: Number.isFinite(total) ? total : 0,
		verified: Number.isFinite(verified) ? verified : 0,
		unverified: Number.isFinite(unverified) ? unverified : 0,
	}
}

const getInitialFormState = (overrides = {}) => ({
	firstname: "",
	lastname: "",
	email: "",
	contactNumber: "",
	gender: "Male",
	birthday: "",
	password: "",
	roleId: String(ROLE_IDS.TECHNICIAN),
	...overrides,
})

const getVerifiedParam = (status) => {
	if (status === "verified") return true
	if (status === "unverified") return false
	return undefined
}

const normalizeContactNumber = (value) => {
	if (!value) return null
	const digits = String(value).replace(/\D+/g, "")
	return digits.length ? digits : null
}

const VerifiedBadge = ({ isVerified }) => {
	if (isVerified) {
		return (
			<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
				<BadgeCheck className="h-3.5 w-3.5" />
				Verified
			</span>
		)
	}

	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
			<AlertCircle className="h-3.5 w-3.5" />
			Not verified
		</span>
	)
}

const StatusBanner = ({ type, message, onDismiss }) => {
	if (!message) return null

	const isError = type === "error"
	const isInfo = type === "info"

	const palette = {
		border: isError ? "border-rose-200" : isInfo ? "border-amber-200" : "border-emerald-200",
		background: isError ? "bg-rose-50" : isInfo ? "bg-amber-50" : "bg-emerald-50",
		text: isError ? "text-rose-700" : isInfo ? "text-amber-700" : "text-emerald-700",
		Icon: isError ? AlertCircle : isInfo ? AlertCircle : BadgeCheck,
	}

	const Icon = palette.Icon

	return (
		<div className={`flex items-start gap-3 rounded-2xl border ${palette.border} ${palette.background} px-4 py-3 ${palette.text}`}>
			<Icon className="mt-0.5 h-5 w-5 shrink-0" />
			<p className="flex-1 text-sm leading-5">{message}</p>
			<button
				type="button"
				onClick={onDismiss}
				className="rounded-full p-1 text-slate-400 transition hover:bg-white/60 hover:text-slate-600"
			>
				<X className="h-4 w-4" />
				<span className="sr-only">Dismiss</span>
			</button>
		</div>
	)
}


const UserActionButtons = ({
	user,
	onEdit,
	onResetPassword,
	onDelete,
	resetting,
	deleting,
}) => (
	<div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
		<button
			type="button"
			onClick={() => onEdit(user)}
			className="inline-flex min-w-[118px] items-center justify-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600"
		>
			<Edit2 className="h-3.5 w-3.5" />
			Edit
		</button>
		<button
			type="button"
			onClick={() => onResetPassword(user)}
			disabled={resetting}
			className={`inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
				resetting
					? "border-indigo-200 bg-indigo-100 text-indigo-500"
					: "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
			}`}
		>
			{resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
			Reset
		</button>
		<button
			type="button"
			onClick={() => onDelete(user)}
			disabled={deleting}
			className={`inline-flex min-w-[100px] items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
				deleting
					? "border-rose-200 bg-rose-100 text-rose-500"
					: "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
			}`}
		>
			{deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
			Delete
		</button>
	</div>
)

export default function UserManagement() {
	const storedUser = useMemo(resolveStoredUser, [])
	const [sessionUser, setSessionUser] = useState(() => storedUser)
	const [accessChecked, setAccessChecked] = useState(false)

	const [users, setUsers] = useState([])
	const [pagination, setPagination] = useState(DEFAULT_PAGINATION)
	const [summary, setSummary] = useState(DEFAULT_SUMMARY)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState("")
	const [banner, setBanner] = useState(null)

	const [page, setPage] = useState(1)
	const [searchTerm, setSearchTerm] = useState("")
	const [searchInput, setSearchInput] = useState("")

	const [filters, setFilters] = useState({
		status: "all",
		gender: "all",
		role: "all",
		sortId: DEFAULT_SORT_ID,
	})

	const [actionState, setActionState] = useState({ type: null, id: null })

	const [modalOpen, setModalOpen] = useState(false)
	const [modalMode, setModalMode] = useState("create")
	const [formState, setFormState] = useState(() => getInitialFormState())
	const [showPassword, setShowPassword] = useState(false)
	const [formError, setFormError] = useState("")
	const [submitting, setSubmitting] = useState(false)
	const [editingUser, setEditingUser] = useState(null)

	const [passwordModal, setPasswordModal] = useState(DEFAULT_PASSWORD_MODAL)

	const rawRoleId = sessionUser?.roleID ?? sessionUser?.roleid
	const currentRoleId = rawRoleId === undefined || rawRoleId === null ? null : Number(rawRoleId)
	const isSuperAdmin = currentRoleId === ROLE_IDS.SUPERADMIN
	const canManageUsers = currentRoleId === ROLE_IDS.SUPERADMIN || currentRoleId === ROLE_IDS.ADMIN

	const activeSortOption = useMemo(
		() => SORT_OPTIONS.find((option) => option.id === filters.sortId) ?? SORT_OPTIONS[0],
		[filters.sortId]
	)

	const entityLabelSingular = isSuperAdmin ? "user" : "technician"
	const entityLabelPlural = isSuperAdmin ? "Users" : "Technicians"
	const entityLabelPluralLower = entityLabelPlural.toLowerCase()

	const totalRecords = pagination.total ?? users.length ?? 0
	const verifiedTotal = summary.verified ?? 0
	const unverifiedTotal = summary.unverified ?? 0

	const filtersSummary = useMemo(() => {
		const parts = []
		if (filters.status !== "all") {
			parts.push(`Status: ${filters.status === "verified" ? "Verified" : "Not verified"}`)
		}
		if (filters.gender !== "all") {
			parts.push(`Gender: ${filters.gender.charAt(0).toUpperCase()}${filters.gender.slice(1)}`)
		}
		if (isSuperAdmin && filters.role !== "all") {
			const label = ROLE_LABELS[ROLE_SLUG_TO_ID[filters.role]] ?? filters.role
			parts.push(`Role: ${label}`)
		}
		if (searchTerm) {
			parts.push(`Search: "${searchTerm}"`)
		}
		return parts.length ? parts.join(" • ") : "No filters applied"
	}, [filters.gender, filters.role, filters.status, isSuperAdmin, searchTerm])

	const roleCards = useMemo(() => {
		if (!isSuperAdmin) return []
		return [
			{
				roleId: ROLE_IDS.SUPERADMIN,
				label: "Super admins",
				icon: ShieldCheck,
				stats: getRoleStats(summary.roleCounts, ROLE_IDS.SUPERADMIN),
			},
			{
				roleId: ROLE_IDS.ADMIN,
				label: "Admins",
				icon: KeyRound,
				stats: getRoleStats(summary.roleCounts, ROLE_IDS.ADMIN),
			},
			{
				roleId: ROLE_IDS.TECHNICIAN,
				label: "Technicians",
				icon: UserPlus,
				stats: getRoleStats(summary.roleCounts, ROLE_IDS.TECHNICIAN),
			},
		]
	}, [isSuperAdmin, summary.roleCounts])

	useEffect(() => {
		let active = true

		const hydrateSession = async () => {
			try {
				const response = await axios.get("/api/user/me", { withCredentials: true })
				const payload = response?.data?.data ?? response?.data ?? null
				if (active && payload) {
					setSessionUser(payload)
				}
					} catch {
						if (active) {
							setSessionUser(null)
						}
			} finally {
				if (active) {
					setAccessChecked(true)
				}
			}
		}

		hydrateSession()

		return () => {
			active = false
		}
	}, [])

	useEffect(() => {
		setSearchInput(searchTerm)
	}, [searchTerm])

	const fetchUsers = useCallback(async () => {
		if (!canManageUsers) return

		setLoading(true)
		setError("")

		const params = {
			page,
			pageSize: DEFAULT_PAGE_SIZE,
			sortBy: activeSortOption.sortBy,
			sortOrder: activeSortOption.sortOrder,
		}

		if (searchTerm) {
			params.search = searchTerm
		}

		if (filters.gender !== "all") {
			params.gender = filters.gender
		}

		const verifiedParam = getVerifiedParam(filters.status)
		if (verifiedParam !== undefined) {
			params.verified = verifiedParam
		}

		if (isSuperAdmin && filters.role !== "all") {
			params.roles = ROLE_SLUG_TO_ID[filters.role]
		}

		try {
			const response = await axios.get("/api/user", { params, withCredentials: true })
			const payload = response?.data?.data ?? response?.data ?? {}
			const results = Array.isArray(payload.results) ? payload.results : []
			const paginationPayload = payload.pagination ?? {}
			const summaryPayload = payload.summary ?? {}

			setUsers(results)
			setPagination({
				page: paginationPayload.page ?? page,
				pageSize: paginationPayload.pageSize ?? DEFAULT_PAGE_SIZE,
				total: paginationPayload.total ?? results.length ?? 0,
				totalPages: paginationPayload.totalPages ?? 1,
				hasNextPage: Boolean(paginationPayload.hasNextPage),
				hasPreviousPage: Boolean(paginationPayload.hasPreviousPage),
			})
			setSummary({
				verified: summaryPayload.verified ?? 0,
				unverified: summaryPayload.unverified ?? 0,
				roleCounts: summaryPayload.roleCounts ?? {},
			})
		} catch (err) {
			const message = err?.response?.data?.message || err?.message || "Failed to load users."
			setError(message)
			setUsers([])
			setPagination((prev) => ({ ...prev, total: 0 }))
			setSummary(DEFAULT_SUMMARY)
			if (err?.response?.status === 403) {
				setBanner({ type: "error", message })
			}
		} finally {
			setLoading(false)
		}
	}, [activeSortOption.sortBy, activeSortOption.sortOrder, canManageUsers, filters.gender, filters.role, filters.status, isSuperAdmin, page, searchTerm])

	useEffect(() => {
		if (!accessChecked) return
		if (!canManageUsers) return
		fetchUsers()
	}, [accessChecked, canManageUsers, fetchUsers])

	const goToPage = (nextPage) => {
		if (nextPage === page) return
		if (nextPage < 1) return
		if (pagination.totalPages && nextPage > pagination.totalPages) return
		setPage(nextPage)
	}

	const updateFilters = (updates) => {
		setFilters((prev) => ({ ...prev, ...updates }))
		if (
			Object.prototype.hasOwnProperty.call(updates, "status") ||
			Object.prototype.hasOwnProperty.call(updates, "gender") ||
			Object.prototype.hasOwnProperty.call(updates, "role") ||
			Object.prototype.hasOwnProperty.call(updates, "sortId")
		) {
			setPage(1)
		}
	}

	const resetFilters = () => {
		setFilters({ status: "all", gender: "all", role: "all", sortId: DEFAULT_SORT_ID })
		setSearchTerm("")
		setSearchInput("")
		setPage(1)
	}

	const handleSearchSubmit = (event) => {
		event.preventDefault()
		const trimmed = searchInput.trim()
		setSearchTerm(trimmed)
		setPage(1)
	}

	const handleClearSearch = () => {
		setSearchInput("")
		if (searchTerm) {
			setSearchTerm("")
			setPage(1)
		}
	}

	const dismissBanner = () => setBanner(null)

	const isActionLoading = (type, id) => actionState.type === type && actionState.id === id
	const isPasswordActionLoading = (id) =>
		passwordModal.loading && passwordModal.technician?.userid === id && passwordModal.open

	const openCreateModal = () => {
		setModalMode("create")
		setFormState(getInitialFormState({ roleId: String(ROLE_IDS.TECHNICIAN) }))
		setFormError("")
		setShowPassword(false)
		setEditingUser(null)
		setModalOpen(true)
	}

	const openEditModal = (user) => {
		setModalMode("edit")
		setEditingUser(user)
		setFormState(
			getInitialFormState({
				firstname: user.firstname ?? "",
				lastname: user.lastname ?? "",
				email: user.email ?? "",
				contactNumber: user.contactnumber ?? "",
				gender: user.gender ?? "Male",
				birthday: user.birthday ? String(user.birthday).slice(0, 10) : "",
				password: "",
				roleId: String(user.roleid ?? ROLE_IDS.TECHNICIAN),
			})
		)
		setFormError("")
		setShowPassword(false)
		setModalOpen(true)
	}

	const closeModal = () => {
		if (submitting) return
		setModalOpen(false)
		setModalMode("create")
		setFormState(getInitialFormState())
		setEditingUser(null)
		setFormError("")
		setShowPassword(false)
	}

	const handleFormChange = (event) => {
		const { name, value } = event.target
		setFormState((prev) => ({ ...prev, [name]: value }))
	}

	const handleSubmit = async (event) => {
		event.preventDefault()
		setFormError("")

		const firstname = formState.firstname.trim()
		const lastname = formState.lastname.trim()
		const email = formState.email.trim().toLowerCase()
		const password = formState.password.trim()

		if (!firstname) {
			setFormError("First name is required.")
			return
		}

		if (!lastname) {
			setFormError("Last name is required.")
			return
		}

		if (!email) {
			setFormError("Email address is required.")
			return
		}

		if (modalMode === "create" && password.length === 0) {
			setFormError("Please provide an initial password.")
			return
		}

		if (password.length > 0 && password.length < 8) {
			setFormError("Password must be at least 8 characters long.")
			return
		}

		const payload = {
			firstname,
			lastname,
			email,
			gender: formState.gender || null,
			contactNumber: normalizeContactNumber(formState.contactNumber),
			birthday: formState.birthday || null,
		}

		if (password.length > 0) {
			payload.password = password
		}

		if (isSuperAdmin) {
			payload.roleId = Number(formState.roleId)
		}

		try {
			setSubmitting(true)
			if (modalMode === "create") {
				await axios.post("/api/user", payload, { withCredentials: true })
			} else if (editingUser?.userid) {
				await axios.put(`/api/user/${editingUser.userid}`, payload, { withCredentials: true })
			}

			const successName = composeFullName({ firstname, lastname, email })
			setBanner({
				type: "success",
				message:
					modalMode === "create"
						? `Created ${entityLabelSingular} account for ${successName}.`
						: `Updated ${entityLabelSingular} details for ${successName}.`,
			})

			closeModal()

			if (modalMode === "create") {
				setPage(1)
			}

			fetchUsers()
		} catch (err) {
			const message = err?.response?.data?.message || err?.message || "Failed to save account."
			setFormError(message)
		} finally {
			setSubmitting(false)
		}
	}

	const handleDelete = async (user) => {
		const name = composeFullName(user)
		const confirmation = window.confirm(`Delete ${entityLabelSingular} account for ${name}? This cannot be undone.`)
		if (!confirmation) return

		setActionState({ type: "delete", id: user.userid })
		try {
			await axios.delete(`/api/user/${user.userid}`, { withCredentials: true })
			setBanner({ type: "success", message: `Deleted ${entityLabelSingular} account for ${name}.` })
			if (users.length === 1 && page > 1) {
				setPage((prev) => Math.max(1, prev - 1))
			} else {
				fetchUsers()
			}
		} catch (err) {
			const message = err?.response?.data?.message || err?.message || "Failed to delete account."
			setBanner({ type: "error", message })
		} finally {
			setActionState({ type: null, id: null })
		}
	}

	const _handleResendVerification = async (user) => {
		setActionState({ type: "verification", id: user.userid })
		try {
			const response = await axios.post(`/api/user/${user.userid}/resend-verification`, {}, { withCredentials: true })
			const status = response?.status ?? 200
			const payload = response?.data?.data ?? response?.data ?? {}
			const fallbackLink = payload?.verificationUrl ?? payload?.verification_url ?? ""
			const serverMessage = response?.data?.message ?? null
			const actorName = composeFullName(user)

			if (status === 202) {
				let copiedToClipboard = false
				if (fallbackLink) {
					try {
						await navigator.clipboard.writeText(fallbackLink)
						copiedToClipboard = true
					} catch {
						copiedToClipboard = false
					}
				}

				setBanner({
					type: "info",
					message: copiedToClipboard && fallbackLink
						? `Email delivery didn’t reach ${actorName}, but a manual verification link was generated and copied to your clipboard.`
						: fallbackLink
							? `Email delivery didn’t reach ${actorName}. Share this one-time verification link manually: ${fallbackLink}`
							: `Email delivery didn’t reach ${actorName}, but the verification request was recorded. Try again shortly.`,
				})
				return
			}

			setBanner({
				type: "success",
				message: serverMessage || `Verification email queued for ${actorName}.`,
			})
		} catch (err) {
			const message = err?.response?.data?.message || err?.message || "Failed to resend verification email."
			setBanner({ type: "error", message })
		} finally {
			setActionState({ type: null, id: null })
		}
	}

	const handleIssueTemporaryPassword = (user) => {
		setPasswordModal({ ...DEFAULT_PASSWORD_MODAL, open: true, technician: user })
	}

	const closePasswordModal = () => {
		setPasswordModal(DEFAULT_PASSWORD_MODAL)
	}

	const issueTemporaryPassword = async () => {
		if (!passwordModal.technician) return

		const technician = passwordModal.technician
		setPasswordModal((prev) => ({ ...prev, loading: true, error: "", temporaryPassword: "", copied: false }))

		try {
			const response = await axios.post(`/api/user/${technician.userid}/reset-password`, {}, { withCredentials: true })
			const payload = response?.data?.data ?? response?.data ?? {}
			const temporaryPassword = payload.temporaryPassword ?? payload.password ?? ""

			if (!temporaryPassword) {
				throw new Error("Temporary password was not provided by the server.")
			}

			setPasswordModal((prev) => ({ ...prev, loading: false, temporaryPassword }))
			setBanner({
				type: "success",
				message: `Generated a temporary password for ${composeFullName(technician)}. Share it securely and remind them to update it after logging in.`,
			})
			fetchUsers()
		} catch (err) {
			const message = err?.response?.data?.message || err?.message || "Failed to generate temporary password."
			setPasswordModal((prev) => ({ ...prev, loading: false, error: message }))
		}
	}

	const copyTemporaryPassword = async () => {
		if (!passwordModal.temporaryPassword) return
		try {
			await navigator.clipboard.writeText(passwordModal.temporaryPassword)
			setPasswordModal((prev) => ({ ...prev, copied: true }))
			window.setTimeout(() => {
				setPasswordModal((prev) => ({ ...prev, copied: false }))
			}, 2000)
		} catch {
			setPasswordModal((prev) => ({ ...prev, error: "Unable to copy password automatically. Copy it manually instead." }))
		}
	}

	const handleRefresh = () => {
		fetchUsers()
	}

	const getActionIndicators = (user) => ({
		verifying: isActionLoading("verification", user.userid),
		deleting: isActionLoading("delete", user.userid),
		resetting: isPasswordActionLoading(user.userid),
	})

	const EmptyDirectoryState = () => (
		<div className="flex flex-col items-center gap-3 text-center">
			<p className="text-sm text-slate-500">No {entityLabelPluralLower} matched the current filters.</p>
			<div className="flex flex-wrap justify-center gap-2">
				<button
					type="button"
					onClick={resetFilters}
					className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-emerald-200 hover:text-emerald-600"
				>
					<Filter className="h-4 w-4" />
					Reset filters
				</button>
				<button
					type="button"
					onClick={openCreateModal}
					className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:from-emerald-600 hover:to-teal-600"
				>
					<Plus className="h-4 w-4" />
					Add {entityLabelSingular}
				</button>
			</div>
		</div>
	)

	const colSpanValue = isSuperAdmin ? 8 : 7
	const showEmptyState = !loading && users.length === 0

	if (!accessChecked) {
		return (
			<section className="flex h-full min-h-[60vh] items-center justify-center p-6">
				<span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
					<Loader2 className="h-4 w-4 animate-spin" />
					Checking administrative privileges…
				</span>
			</section>
		)
	}

	if (!canManageUsers) {
		return (
			<section className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
				<div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-700">
					<p className="text-base font-semibold">Access restricted</p>
					<p className="mt-1 text-sm text-amber-700/80">
						Only administrator accounts can view the user management console.
					</p>
				</div>
			</section>
		)
	}

	const modalTitle = modalMode === "create" ? `Add ${entityLabelSingular}` : `Edit ${entityLabelSingular}`
	const modalSubtitle =
		modalMode === "create"
			? `Set credentials and contact details for the new ${entityLabelSingular} account.`
			: `Update the profile and access settings for ${editingUser ? composeFullName(editingUser) : `this ${entityLabelSingular}`}.`
	const submitButtonLabel = modalMode === "create" ? "Create account" : "Save changes"
	const passwordFieldLabel = modalMode === "create" ? "Password" : "New password"
	const passwordHelperText =
		modalMode === "create"
			? "Share the password securely and ask them to change it on first login."
			: "Leave blank to keep the current password unchanged."

	return (
		<section className="bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
			<div className="mx-auto w-full max-w-7xl space-y-6">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div className="space-y-2">
					<p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">Administration</p>
					<h1 className="text-2xl font-semibold uppercase tracking-[0.08em] text-emerald-800">User management</h1>
					<p className="max-w-2xl text-sm text-slate-500">
						Maintain {entityLabelPluralLower} accounts, resend verification emails, and issue temporary passwords from a single, spacious view.
					</p>
				</div>
				<div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
					<form onSubmit={handleSearchSubmit} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
						<div className="relative flex-1">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
							<input
								type="search"
								placeholder={`Search ${entityLabelPluralLower} by name, email, or contact`}
								value={searchInput}
								onChange={(event) => setSearchInput(event.target.value)}
								className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-11 text-sm text-slate-700 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
							/>
							{searchInput ? (
								<button
									type="button"
									onClick={handleClearSearch}
									className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white/80 px-2 py-1 text-xs text-slate-500 transition hover:border-emerald-200 hover:text-emerald-600"
								>
									Clear
								</button>
							) : null}
						</div>
						<button
							type="submit"
							className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500 bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
						>
							<Search className="h-4 w-4" />
							Search
						</button>
					</form>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleRefresh}
							className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:text-emerald-600"
							disabled={loading}
						>
							{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
							Refresh
						</button>
						<button
							type="button"
							onClick={openCreateModal}
							className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-emerald-600 hover:to-teal-600"
						>
							<Plus className="h-4 w-4" />
							New {entityLabelSingular}
						</button>
					</div>
				</div>
			</div>

			{banner ? <StatusBanner type={banner.type} message={banner.message} onDismiss={dismissBanner} /> : null}

			{error ? (
				<div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
					<div className="flex items-center gap-2">
						<AlertCircle className="h-4 w-4" />
						<span>{error}</span>
					</div>
					<button
						type="button"
						onClick={fetchUsers}
						className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
					>
						Retry
					</button>
				</div>
			) : null}

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{isSuperAdmin
					? roleCards.map((card) => {
							const Icon = card.icon
							return (
								<article key={card.roleId} className="rounded-3xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
									<div className="flex items-center justify-between">
										<p className="text-sm font-semibold text-slate-600">{card.label}</p>
										<span className="rounded-full bg-emerald-500/10 p-2 text-emerald-600">
											<Icon className="h-4 w-4" />
										</span>
									</div>
									<p className="mt-3 text-3xl font-semibold text-slate-900">{card.stats.total}</p>
									<p className="mt-2 text-xs text-slate-500">
										{card.stats.verified} verified • {card.stats.unverified} not verified
									</p>
								</article>
							)
						})
					: (
						<>
								<article className="rounded-3xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
								<div className="flex items-center justify-between">
										<p className="text-sm font-semibold text-slate-600">Total {entityLabelPluralLower}</p>
										<span className="rounded-full bg-emerald-500/10 p-2 text-emerald-600">
										<Users className="h-4 w-4" />
									</span>
								</div>
									<p className="mt-3 text-3xl font-semibold text-slate-900">{totalRecords}</p>
								<p className="mt-2 text-xs text-slate-500">Across assigned barangays</p>
							</article>
							<article className="rounded-3xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
								<div className="flex items-center justify-between">
									<p className="text-sm font-semibold text-slate-600">Verified</p>
									<span className="rounded-full bg-emerald-500/10 p-2 text-emerald-600">
										<BadgeCheck className="h-4 w-4" />
									</span>
								</div>
								<p className="mt-3 text-3xl font-semibold text-slate-900">{verifiedTotal}</p>
								<p className="mt-2 text-xs text-slate-500">Email confirmed accounts</p>
							</article>
							<article className="rounded-3xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
								<div className="flex items-center justify-between">
									<p className="text-sm font-semibold text-slate-600">Not verified</p>
									<span className="rounded-full bg-rose-100/70 p-2 text-rose-500">
										<AlertCircle className="h-4 w-4" />
									</span>
								</div>
								<p className="mt-3 text-3xl font-semibold text-slate-900">{unverifiedTotal}</p>
								<p className="mt-2 text-xs text-slate-500">Awaiting email confirmation</p>
							</article>
							<article className="rounded-3xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
								<div className="flex items-center justify-between">
									<p className="text-sm font-semibold text-slate-600">Current filters</p>
									<span className="rounded-full bg-emerald-500/10 p-2 text-emerald-600">
										<Filter className="h-4 w-4" />
									</span>
								</div>
								<p className="mt-3 text-sm font-medium text-emerald-600">{filtersSummary}</p>
								<p className="mt-2 text-xs text-slate-500">Sorted by {activeSortOption.label.toLowerCase()}</p>
							</article>
						</>
					)}
			</section>

			<section className="rounded-3xl border border-emerald-100/70 bg-white/90 shadow-sm shadow-emerald-900/5">
				<div className="flex flex-col gap-5 border-b border-slate-200 p-6">
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div className="space-y-1">
							<h2 className="text-lg font-semibold text-slate-900">Directory</h2>
							<p className="text-sm text-slate-500">
								Filter {entityLabelPluralLower} by verification status, gender, or role.
							</p>
						</div>
						<select
							value={filters.sortId}
							onChange={(event) => updateFilters({ sortId: event.target.value })}
							className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
						>
							{SORT_OPTIONS.map((option) => (
								<option key={option.id} value={option.id}>
									{option.label}
								</option>
							))}
						</select>
					</div>

					<div className="flex flex-wrap gap-2 sm:flex-nowrap sm:overflow-x-auto sm:pb-1 sm:[&::-webkit-scrollbar]:hidden">
						{STATUS_FILTERS.map((filter) => {
							const isActive = filters.status === filter.id
							return (
								<button
									key={filter.id}
									type="button"
									onClick={() => updateFilters({ status: filter.id })}
									className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
										isActive
											? "border-emerald-500 bg-emerald-50 text-emerald-700"
											: "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-600"
									}`}
								>
									{filter.label}
								</button>
							)
						})}
					</div>

					<div className="flex flex-wrap gap-2 sm:flex-nowrap sm:overflow-x-auto sm:pb-1 sm:[&::-webkit-scrollbar]:hidden">
						{GENDER_FILTERS.map((filter) => {
							const isActive = filters.gender === filter.id
							return (
								<button
									key={filter.id}
									type="button"
									onClick={() => updateFilters({ gender: filter.id })}
									className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
										isActive
											? "border-emerald-500 bg-emerald-50 text-emerald-700"
											: "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-600"
									}`}
								>
									{filter.label}
								</button>
							)
						})}
					</div>

					{isSuperAdmin ? (
						<div className="flex flex-wrap gap-2 sm:flex-nowrap sm:overflow-x-auto sm:pb-1 sm:[&::-webkit-scrollbar]:hidden">
							{ROLE_FILTERS.map((filter) => {
								const isActive = filters.role === filter.id
								return (
									<button
										key={filter.id}
										type="button"
										onClick={() => updateFilters({ role: filter.id })}
										className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
											isActive
												? "border-emerald-500 bg-emerald-50 text-emerald-700"
												: "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-600"
										}`}
									>
										{filter.label}
									</button>
								)
							})}
						</div>
					) : null}
				</div>

				<div className="hidden lg:block">
					<div className="overflow-x-auto">
						<table className="min-w-full table-auto text-sm text-slate-700">
							<thead className="bg-slate-50 text-slate-500">
								<tr>
									<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Name</th>
									<th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] xl:table-cell">Email</th>
									<th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] 2xl:table-cell">Contact</th>
									<th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] xl:table-cell">Gender</th>
									{isSuperAdmin ? (
										<th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] xl:table-cell">Role</th>
									) : null}
									<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Verification</th>
									<th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] xl:table-cell">Created</th>
									<th className="min-w-[200px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Actions</th>
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr>
										<td colSpan={colSpanValue} className="px-4 py-10 text-center text-slate-400">
											<span className="inline-flex items-center gap-2 text-sm font-medium">
												<Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
												Fetching {entityLabelPluralLower}…
											</span>
										</td>
									</tr>
								) : showEmptyState ? (
									<tr>
										<td colSpan={colSpanValue} className="px-4 py-10 text-center text-slate-400">
											<EmptyDirectoryState />
										</td>
									</tr>
								) : (
									users.map((user) => {
										const { deleting, resetting } = getActionIndicators(user)

										return (
											<tr key={user.userid} className="hover:bg-slate-50">
												<td className="px-4 py-4 align-top">
													<div className="space-y-1">
														<div className="text-sm font-semibold text-slate-900">{composeFullName(user)}</div>
														<div className="text-xs text-slate-500">ID #{user.userid}</div>
													</div>
													<div className="mt-3 space-y-1 text-xs text-slate-500 xl:hidden">
														<div className="flex flex-wrap gap-2">
															<span className="font-semibold uppercase tracking-[0.18em] text-slate-400">Email</span>
															<span className="break-all text-slate-600">{user.email}</span>
														</div>
														<div className="flex flex-wrap gap-2">
															<span className="font-semibold uppercase tracking-[0.18em] text-slate-400">Contact</span>
															<span className="text-slate-600">{user.contactnumber || "—"}</span>
														</div>
														<div className="flex flex-wrap gap-2">
															<span className="font-semibold uppercase tracking-[0.18em] text-slate-400">Gender</span>
															<span className="capitalize text-slate-600">{user.gender || "—"}</span>
														</div>
														{isSuperAdmin ? (
															<div className="flex flex-wrap items-center gap-2">
																<span className="font-semibold uppercase tracking-[0.18em] text-slate-400">Role</span>
																<span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
																	{ROLE_LABELS[user.roleid] ?? "—"}
																</span>
															</div>
														) : null}
														<div className="flex flex-wrap gap-2">
															<span className="font-semibold uppercase tracking-[0.18em] text-slate-400">Created</span>
															<span className="text-slate-600">{formatDate(user.createdat)}</span>
														</div>
													</div>
												</td>
												<td className="hidden break-words px-4 py-4 align-top text-slate-600 xl:table-cell">{user.email}</td>
												<td className="hidden px-4 py-4 align-top text-slate-600 2xl:table-cell">{user.contactnumber || "—"}</td>
												<td className="hidden px-4 py-4 align-top capitalize text-slate-600 xl:table-cell">{user.gender || "—"}</td>
												{isSuperAdmin ? (
													<td className="hidden px-4 py-4 align-top text-slate-600 xl:table-cell">
														<span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
															{ROLE_LABELS[user.roleid] ?? "—"}
														</span>
													</td>
												) : null}
												<td className="px-4 py-4 align-top">
													<VerifiedBadge isVerified={Boolean(user.is_verified)} />
												</td>
												<td className="hidden px-4 py-4 align-top text-slate-600 xl:table-cell">{formatDate(user.createdat)}</td>
												<td className="px-4 py-4 align-top">
													<UserActionButtons
														user={user}
														onEdit={openEditModal}
														onResetPassword={handleIssueTemporaryPassword}
														onDelete={handleDelete}
														resetting={resetting}
														deleting={deleting}
													/>
												</td>
											</tr>
										)
									})
								)}
							</tbody>
						</table>
					</div>
				</div>

				<div className="space-y-3 lg:hidden">
					{loading ? (
						<div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
							<div className="flex items-center gap-3">
								<span className="loading loading-spinner loading-sm text-emerald-500" aria-hidden="true" />
								Fetching {entityLabelPluralLower}…
							</div>
						</div>
					) : showEmptyState ? (
						<div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
							<EmptyDirectoryState />
						</div>
					) : (
						users.map((user) => {
							const { deleting, resetting } = getActionIndicators(user)

							return (
								<article key={user.userid} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
									<header className="flex items-start justify-between gap-2">
										<div>
											<p className="text-base font-semibold text-slate-900">{composeFullName(user)}</p>
											<p className="text-xs text-slate-500">ID #{user.userid}</p>
										</div>
										{isSuperAdmin ? (
											<span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
												{ROLE_LABELS[user.roleid] ?? "—"}
											</span>
										) : null}
									</header>
									<dl className="mt-3 grid gap-2 text-sm text-slate-600">
										<div>
											<dt className="text-xs uppercase tracking-[0.2em] text-slate-400">Email</dt>
											<dd className="mt-1 break-words text-slate-700">{user.email}</dd>
										</div>
										<div>
											<dt className="text-xs uppercase tracking-[0.2em] text-slate-400">Contact</dt>
											<dd className="mt-1 text-slate-700">{user.contactnumber || "—"}</dd>
										</div>
										<div className="grid grid-cols-2 gap-2">
											<div>
												<dt className="text-xs uppercase tracking-[0.2em] text-slate-400">Gender</dt>
												<dd className="mt-1 capitalize text-slate-700">{user.gender || "—"}</dd>
											</div>
											<div>
												<dt className="text-xs uppercase tracking-[0.2em] text-slate-400">Created</dt>
												<dd className="mt-1 text-slate-700">{formatDate(user.createdat)}</dd>
											</div>
										</div>
									</dl>
									<div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
										<VerifiedBadge isVerified={Boolean(user.is_verified)} />
										<span className="text-[11px] text-slate-400">Last update: {formatDate(user.updatedat ?? user.createdat)}</span>
									</div>
									<div className="mt-3">
										<UserActionButtons
											user={user}
											onEdit={openEditModal}
											onResetPassword={handleIssueTemporaryPassword}
											onDelete={handleDelete}
											resetting={resetting}
											deleting={deleting}
										/>
									</div>
								</article>
							)
						})
					)}
				</div>

				<footer className="flex flex-col items-center gap-3 border-t border-slate-200 px-6 py-4 text-sm text-slate-500 md:flex-row md:justify-between">
					<div>
						Showing page {pagination.page} of {pagination.totalPages} • {pagination.total} total {entityLabelPluralLower}
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => goToPage(pagination.page - 1)}
							disabled={!pagination.hasPreviousPage}
							className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-50"
						>
							Previous
						</button>
						<button
							type="button"
							onClick={() => goToPage(pagination.page + 1)}
							disabled={!pagination.hasNextPage}
							className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-50"
						>
							Next
						</button>
					</div>
				</footer>
			</section>

			{modalOpen ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
					<div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
						<div className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-5">
							<div>
								<h3 className="text-xl font-semibold text-slate-900">{modalTitle}</h3>
								<p className="mt-1 text-sm text-slate-600">{modalSubtitle}</p>
							</div>
							<button
								type="button"
								onClick={closeModal}
								className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-600"
								disabled={submitting}
							>
								<X className="h-5 w-5" />
							</button>
						</div>
						<form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto px-6 py-6">
							<div className="grid gap-4 md:grid-cols-2">
								<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
									<span>First name</span>
									<input
										name="firstname"
										value={formState.firstname}
										onChange={handleFormChange}
										type="text"
										className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
										required
									/>
								</label>
								<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
									<span>Last name</span>
									<input
										name="lastname"
										value={formState.lastname}
										onChange={handleFormChange}
										type="text"
										className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
										required
									/>
								</label>
							</div>

							<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
								<span>Email</span>
								<input
									name="email"
									value={formState.email}
									onChange={handleFormChange}
									type="email"
									className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
									required
								/>
							</label>

							<div className="grid gap-4 md:grid-cols-2">
								<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
									<span>Contact number</span>
									<input
										name="contactNumber"
										value={formState.contactNumber}
										onChange={handleFormChange}
										type="tel"
										className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
										placeholder="09XXXXXXXXX"
									/>
								</label>
								<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
									<span>Gender</span>
									<select
										name="gender"
										value={formState.gender}
										onChange={handleFormChange}
										className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
									>
										<option value="Male">Male</option>
										<option value="Female">Female</option>
									</select>
								</label>
							</div>

							{isSuperAdmin ? (
								<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
									<span>Assign role</span>
									<select
										name="roleId"
										value={formState.roleId}
										onChange={handleFormChange}
										className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
									>
										{Object.entries(ROLE_LABELS).map(([roleId, label]) => (
											<option key={roleId} value={roleId}>
												{label}
											</option>
										))}
									</select>
									<span className="text-xs font-normal text-slate-500">
										Only super administrators can assign admin or super admin roles.
									</span>
								</label>
							) : null}

							<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
								<span>Birthday</span>
								<input
									name="birthday"
									value={formState.birthday}
									onChange={handleFormChange}
									type="date"
									className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
								/>
							</label>

							<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
								<span>{passwordFieldLabel}</span>
								<div className="relative">
									<input
										name="password"
										value={formState.password}
										onChange={handleFormChange}
										type={showPassword ? "text" : "password"}
										placeholder={modalMode === "create" ? "Generate a secure starting password" : "Leave blank to keep current"}
										className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
										required={modalMode === "create"}
									/>
									<button
										type="button"
										onClick={() => setShowPassword((prev) => !prev)}
										className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-slate-600"
										aria-label={showPassword ? "Hide password" : "Show password"}
									>
										{showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
									</button>
								</div>
								<span className="text-xs font-normal text-slate-500">{passwordHelperText}</span>
							</label>

							{formError ? (
								<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
									{formError}
								</div>
							) : null}

							<div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
								<button
									type="button"
									onClick={closeModal}
									className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
									disabled={submitting}
								>
									Cancel
								</button>
								<button
									type="submit"
									className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-70"
									disabled={submitting}
								>
									{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
									{submitButtonLabel}
								</button>
							</div>
						</form>
					</div>
				</div>
			) : null}

			{passwordModal.open ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
					<div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
						<div className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-emerald-50 to-white px-6 py-5">
							<div>
								<h3 className="text-xl font-semibold text-slate-900">Reset password</h3>
								<p className="mt-1 text-sm text-slate-600">
									Issue a temporary password for {composeFullName(passwordModal.technician)}.
								</p>
							</div>
							<button
								type="button"
								onClick={closePasswordModal}
								className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-600"
								disabled={passwordModal.loading}
							>
								<X className="h-5 w-5" />
							</button>
						</div>
						<div className="space-y-5 px-6 py-6">
							<p className="text-sm text-slate-600">
								Generating a temporary password revokes the current credentials immediately. Share it securely and remind the user to update it after signing in.
							</p>

							{passwordModal.error ? (
								<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
									{passwordModal.error}
								</div>
							) : null}

							{passwordModal.temporaryPassword ? (
								<div className="space-y-4">
									<div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
										<code className="text-base font-semibold text-emerald-700">{passwordModal.temporaryPassword}</code>
										<button
											type="button"
											onClick={copyTemporaryPassword}
											className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-white px-3 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100"
										>
											<Copy className="h-4 w-4" />
											{passwordModal.copied ? "Copied" : "Copy password"}
										</button>
									</div>
									<p className="text-xs text-slate-500">
										This password expires after first use. Encourage the user to set a new password immediately after logging in.
									</p>
									<div className="flex justify-end">
										<button
											type="button"
											onClick={closePasswordModal}
											className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:to-teal-600"
										>
											Done
										</button>
									</div>
								</div>
							) : (
								<div className="flex justify-end gap-3">
									<button
										type="button"
										onClick={closePasswordModal}
										className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
										disabled={passwordModal.loading}
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={issueTemporaryPassword}
										className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-600 hover:to-emerald-600 disabled:opacity-70"
										disabled={passwordModal.loading}
									>
										{passwordModal.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
										Generate password
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			) : null}
			</div>
		</section>
	)
}
