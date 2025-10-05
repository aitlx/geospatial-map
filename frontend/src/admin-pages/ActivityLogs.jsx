import { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import { History, Search, Filter, GitBranch, ShieldCheck, RefreshCw, AlertTriangle, Layers, Link2, ClipboardList, UserSquare2, Sprout } from "lucide-react"

const ROLE_LABELS = {
  1: "Super Admin",
  2: "Admin",
  3: "Technician",
  4: "Farmer",
}

const ROLE_FILTERS = [
  { id: "all", label: "All roles" },
  { id: "1", label: ROLE_LABELS[1] },
  { id: "2", label: ROLE_LABELS[2] },
  { id: "3", label: ROLE_LABELS[3] },
  { id: "4", label: ROLE_LABELS[4] },
]

const DEFAULT_PAGE_SIZE = 15

const formatTimestamp = (value) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

const formatRelativeTime = (value) => {
  if (!value) return "moments ago"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "moments ago"

  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))

  if (minutes < 1) return "moments ago"
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`

  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(date)
}

const normalizeSearch = (value) => value.trim().toLowerCase()

const resolveDetailsPreview = (details) => {
  if (details === null || details === undefined) {
    return "—"
  }

  if (typeof details === "string") {
    return details
  }

  try {
    return JSON.stringify(details, null, 0)
  } catch {
    return String(details)
  }
}

const deriveActionGroups = (logs) => {
  const groups = new Map()

  logs.forEach((log) => {
    const key = log.action ?? "UNKNOWN"
    if (!groups.has(key)) {
      groups.set(key, 0)
    }
    groups.set(key, groups.get(key) + 1)
  })

  return Array.from(groups.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([action]) => action)
}

const ACTION_LABEL_OVERRIDES = {
  LOGIN: "Signed in",
  LOGOUT: "Signed out",
  CREATE_USER: "Account created",
  UPDATE_USER: "Account updated",
  DELETE_USER: "Account deleted",
  RESET_PASSWORD: "Password reset",
  RESET_TECHNICIAN_PASSWORD: "Temporary password issued",
  RESEND_VERIFICATION_EMAIL: "Verification email reissued",
  APPROVE_SUBMISSION: "Submission approved",
  REJECT_SUBMISSION: "Submission rejected",
  BACKUP_EXPORT: "Backup exported",
  BACKUP_IMPORT: "Backup restored",
  ADD_CROP: "Crop added",
  CREATE_CROP: "Crop added",
  UPDATE_CROP: "Crop updated",
  DELETE_CROP: "Crop removed",
  CREATE_NOTIFICATION: "Notification created",
  UPDATE_NOTIFICATION: "Notification updated",
  DELETE_NOTIFICATION: "Notification deleted",
}

const TARGET_LABEL_OVERRIDES = {
  users: "User account",
  logs: "Audit log",
  submissions: "Submission record",
  notifications: "Notification",
  backups: "Backup archive",
  crops: "Crop record",
  roles: "Role policy",
  sessions: "Session",
  approvals: "Approval queue",
}

const TARGET_ICON_OVERRIDES = {
  users: UserSquare2,
  logs: ClipboardList,
  submissions: Layers,
  notifications: AlertTriangle,
  backups: GitBranch,
  crops: Sprout,
  roles: ShieldCheck,
  sessions: Link2,
  approvals: ClipboardList,
}

const ACTION_PALETTE = {
  default: {
    border: "border-emerald-100",
    badge: "bg-emerald-500/10 text-emerald-600",
  },
  security: {
    border: "border-indigo-100",
    badge: "bg-indigo-500/10 text-indigo-600",
  },
  data: {
    border: "border-amber-100",
    badge: "bg-amber-500/10 text-amber-600",
  },
  risk: {
    border: "border-rose-100",
    badge: "bg-rose-500/10 text-rose-600",
  },
}

const resolveActionPalette = (action) => {
  if (!action) return ACTION_PALETTE.default
  const key = action.toUpperCase()
  if (key.includes("DELETE") || key.includes("REJECT")) return ACTION_PALETTE.risk
  if (key.includes("RESET") || key.includes("LOGIN") || key.includes("LOGOUT")) return ACTION_PALETTE.security
  if (key.includes("BACKUP") || key.includes("IMPORT")) return ACTION_PALETTE.data
  return ACTION_PALETTE.default
}

const toTitleCase = (value = "") =>
  value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ")

const humanizeAction = (value) =>
  ACTION_LABEL_OVERRIDES[value] || (value ? toTitleCase(value) : "Recorded activity")

const humanizeKey = (value) => (value ? toTitleCase(String(value)) : "Detail")

const truncate = (value, limit = 160) => {
  if (!value) return ""
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value
}

const detailToString = (detail) => {
  if (detail === null || detail === undefined) return ""
  if (typeof detail === "string") return detail
  if (typeof detail === "number" || typeof detail === "boolean") return String(detail)
  if (Array.isArray(detail)) return detail.map((entry) => detailToString(entry)).filter(Boolean).join(", ")
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

const extractDetails = (rawDetails) => {
  if (!rawDetails) {
    return { summary: "", meta: [] }
  }

  let details = rawDetails

  if (typeof details === "string") {
    const trimmed = details.trim()
    if (!trimmed.length) {
      return { summary: "", meta: [] }
    }

    try {
      details = JSON.parse(trimmed)
    } catch {
      return { summary: truncate(trimmed), meta: [] }
    }
  }

  if (Array.isArray(details)) {
    return { summary: truncate(detailToString(details)), meta: [] }
  }

  if (typeof details === "object") {
    const { summary, message, description, ...rest } = details
    const primary = summary || message || description || ""
    const meta = Object.entries(rest)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .slice(0, 5)
      .map(([key, value]) => ({
        label: humanizeKey(key),
        value: truncate(detailToString(value), 80),
      }))

    const rawFallback = detailToString(rest)
    const fallback = ["{}", "[]", ""].includes(rawFallback) ? "" : truncate(rawFallback)
    return {
      summary: truncate(primary || fallback),
      meta,
    }
  }

  return { summary: truncate(detailToString(details)), meta: [] }
}

const buildTargetLabel = (table, id) => {
  if (!table && !id) return "General system activity"

  const base = TARGET_LABEL_OVERRIDES[table] || toTitleCase(String(table || "")) || "System"
  if (!id) return base
  return `${base} #${id}`
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [actionFilter, setActionFilter] = useState("all")
  const pageSize = DEFAULT_PAGE_SIZE
  const [page, setPage] = useState(1)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axios.get("/api/logs", { withCredentials: true })
      const payload = response?.data?.data ?? response?.data ?? []
      setLogs(Array.isArray(payload) ? payload : [])
      setError("")
      setLastRefresh(new Date())
    } catch (err) {
      const status = err.response?.status
      if (status === 403) {
        setError("You do not have permission to view system-wide activity logs.")
      } else if (status === 401) {
        setError("Your session has expired. Please sign in again to continue.")
      } else {
        setError(err.response?.data?.message || err.message || "Failed to load activity logs.")
      }
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const actions = useMemo(() => deriveActionGroups(logs), [logs])

  useEffect(() => {
    if (!actions.length) {
      setActionFilter("all")
    } else if (actionFilter !== "all" && !actions.includes(actionFilter)) {
      setActionFilter("all")
    }
  }, [actions, actionFilter])

  const filteredLogs = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm)
    const selectedRoleId = roleFilter === "all" ? null : Number(roleFilter)
    const selectedAction = actionFilter === "all" ? null : actionFilter

    return logs
      .filter((log) => {
        if (selectedRoleId && Number(log.roleid) !== selectedRoleId) {
          return false
        }
        if (selectedAction && log.action !== selectedAction) {
          return false
        }
        if (!normalizedSearch.length) {
          return true
        }

        const haystack = [
          log.actor,
          ROLE_LABELS[log.roleid],
          log.action,
          log.target_table,
          log.target_id,
          resolveDetailsPreview(log.details),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()

        return haystack.includes(normalizedSearch)
      })
  }, [actionFilter, logs, roleFilter, searchTerm])

  const totalFiltered = filteredLogs.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const visibleLogs = filteredLogs.slice(startIndex, endIndex)
  const firstVisible = totalFiltered === 0 ? 0 : startIndex + 1
  const lastVisible = Math.min(endIndex, totalFiltered)
  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < totalPages

  useEffect(() => {
    setPage(1)
  }, [roleFilter, actionFilter, searchTerm])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const handleSubmitSearch = (event) => {
    event.preventDefault()
    setSearchTerm(searchInput)
  }

  const handleResetSearch = () => {
    setSearchInput("")
    setSearchTerm("")
  }

  const handleRefresh = () => {
    fetchLogs()
  }

  const lastRefreshLabel = lastRefresh ? formatTimestamp(lastRefresh) : "—"

  return (
    <section className="px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">
            <History className="h-4 w-4 text-amber-600" />
            Audit Trail
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold uppercase tracking-[0.08em] text-emerald-800">Activity Logs</h1>
              <p className="text-sm text-slate-500">
                Review every privileged action: approvals, role assignments, password resets, and more.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Restricted to super administrators
            </div>
          </div>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <form onSubmit={handleSubmitSearch} className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 shadow-sm">
              <Search className="h-4 w-4 text-amber-500" />
              <input
                className="w-full bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
                placeholder="Search by user, action, or resource"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={handleResetSearch}
                  className="text-xs text-amber-600 transition hover:text-amber-500"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="submit"
                className="btn btn-xs border-amber-500 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                disabled={loading}
              >
                Apply
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-amber-500" />
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="select select-xs border border-slate-200 bg-white text-slate-600 focus:border-amber-500"
                >
                  {ROLE_FILTERS.map((filter) => (
                    <option key={filter.id} value={filter.id}>
                      {filter.label}
                    </option>
                  ))}
                </select>
                <select
                  value={actionFilter}
                  onChange={(event) => setActionFilter(event.target.value)}
                  className="select select-xs border border-slate-200 bg-white text-slate-600 focus:border-amber-500"
                >
                  <option value="all">All actions</option>
                  {actions.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-600">
                  15 per page
                </span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="btn btn-xs border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={loading}
                >
                  <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Showing {totalFiltered === 0 ? 0 : `${firstVisible}-${lastVisible}`} of {totalFiltered} matching entries • Last refresh: {lastRefreshLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-amber-600/80">
              <GitBranch className="h-3.5 w-3.5" />
              {actions.length} action types tracked
            </span>
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <div>
              <p className="font-medium text-rose-700">Unable to load activity logs</p>
              <p className="text-rose-600/80">{error}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-rose-600 hover:text-rose-500"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry now
              </button>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
              <div className="flex items-center gap-3 text-sm">
                <span className="loading loading-spinner loading-sm text-amber-500" aria-hidden="true" />
                Fetching latest activity…
              </div>
            </div>
          ) : null}

          {!loading && totalFiltered === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
              <p className="font-medium text-slate-800">No logs match the current filters.</p>
              <p className="text-sm text-slate-500">Adjust your search or filter to see more activity.</p>
            </div>
          ) : null}

          {visibleLogs.map((log) => {
            const roleLabel = ROLE_LABELS[log.roleid] ?? "Unknown role"
            const actionLabel = humanizeAction(log.action)
            const { summary, meta } = extractDetails(log.details)
            const targetLabel = buildTargetLabel(log.target_table, log.target_id)
            const actorName = log.actor?.trim() ? log.actor : "System automation"
            const referenceLabel = log.log_id ? `Log #${log.log_id}` : "—"
            const palette = resolveActionPalette(log.action)
            const TargetIcon = TARGET_ICON_OVERRIDES[log.target_table] ?? ClipboardList

            return (
              <article
                key={log.log_id ?? `${log.actor}-${log.logged_at}`}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md ${palette.border}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${palette.badge}`}>
                      {actionLabel}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">{roleLabel}</span>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{formatTimestamp(log.logged_at)}</p>
                    <p className="text-slate-400">{formatRelativeTime(log.logged_at)}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <p className="text-base font-semibold text-slate-900">{actorName}</p>
                  <p className="text-sm text-slate-600">{summary || "No additional context recorded."}</p>
                </div>

                <dl className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Resource</dt>
                    <dd className="mt-1 inline-flex items-center gap-2 text-slate-600">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <TargetIcon className="h-4 w-4" />
                      </span>
                      {targetLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Reference</dt>
                    <dd className="mt-1 text-slate-600">{referenceLabel}</dd>
                  </div>
                </dl>

                {meta.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {meta.map((item, index) => (
                      <li
                        key={`${log.log_id ?? log.logged_at}-${item.label}-${index}`}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 px-2.5 py-1 text-slate-600"
                      >
                        <span className="font-semibold text-slate-600">{item.label}:</span>
                        <span className="text-slate-500">{item.value}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            )
          })}
        </div>

        {totalFiltered > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm sm:flex-row">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => canGoPrevious && setPage((prev) => Math.max(1, prev - 1))}
                className="btn btn-xs border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canGoPrevious}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => canGoNext && setPage((prev) => Math.min(totalPages, prev + 1))}
                className="btn btn-xs border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canGoNext}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <GitBranch className="h-5 w-5 text-amber-500" />
              Log streams
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Submission reviews, configuration changes, and user management actions will publish to separate streams
              for quicker audits.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              Retention policies
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Configure how long logs are retained and archived to comply with provincial and national guidelines.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
