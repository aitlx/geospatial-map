import { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import { ShieldCheck, KeyRound, UserPlus, Users, Search, RefreshCw, BadgeCheck } from "lucide-react"

const ROLE_LABELS = {
  1: "Super Admin",
  2: "Admin",
  3: "Technician",
}

const ROLE_OPTIONS = [
  { value: 1, label: ROLE_LABELS[1] },
  { value: 2, label: ROLE_LABELS[2] },
  { value: 3, label: ROLE_LABELS[3] },
]

const ROLE_ICONS = {
  1: ShieldCheck,
  2: KeyRound,
  3: UserPlus,
}

const INITIAL_SUMMARY = {
  total: 0,
  verified: 0,
  unverified: 0,
  roleCounts: {},
}

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

const getRoleCounts = (roleCounts, roleId) => {
  const payload = roleCounts?.[roleId] ?? roleCounts?.[String(roleId)] ?? {}
  return {
    total: Number(payload.total) || 0,
    verified: Number(payload.verified) || 0,
    unverified: Number(payload.unverified) || 0,
  }
}

const composeFullName = (user) => {
  const first = user?.firstname?.trim() || ""
  const last = user?.lastname?.trim() || ""
  const combined = `${first} ${last}`.trim()
  return combined.length ? combined : user?.email || "Unknown user"
}

const PAGE_SIZE = 15

export default function RolesAccess() {
  const storedUser = useMemo(resolveStoredUser, [])
  const [sessionUser, setSessionUser] = useState(() => storedUser)
  const [accessChecked, setAccessChecked] = useState(false)

  const currentRoleId = sessionUser?.roleID ?? sessionUser?.roleid ?? null
  const currentUserId = sessionUser?.id ?? sessionUser?.userid ?? null
  const isSuperAdmin = Number(currentRoleId) === 1

  const [summary, setSummary] = useState(INITIAL_SUMMARY)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [statusMessage, setStatusMessage] = useState(null)
  const [roleFilter, setRoleFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [updatingUserId, setUpdatingUserId] = useState(null)
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    if (!isSuperAdmin) {
      setSummary(INITIAL_SUMMARY)
      setUsers([])
      if (accessChecked) {
        setError("Only super administrators can manage roles and access policies.")
      } else {
        setError("")
      }
      return
    }

    setLoading(true)
    try {
      const summaryRequest = axios.get("/api/user/roles/summary")
      const usersRequest = axios.get("/api/user", {
        params: {
          page: 1,
          pageSize: 250,
          sortBy: "name",
          sortOrder: "asc",
        },
      })

      const [summaryResponse, usersResponse] = await Promise.allSettled([summaryRequest, usersRequest])

      if (summaryResponse.status === "fulfilled") {
        const payload = summaryResponse.value?.data?.data ?? {}
        setSummary({
          total: Number(payload.total) || 0,
          verified: Number(payload.summary?.verified) || 0,
          unverified: Number(payload.summary?.unverified) || 0,
          roleCounts: payload.summary?.roleCounts || {},
        })
        setError("")
      } else {
        setSummary(INITIAL_SUMMARY)
        setError(
          summaryResponse.reason?.response?.data?.message ||
            summaryResponse.reason?.message ||
            "Unable to load role summary."
        )
      }

      if (usersResponse.status === "fulfilled") {
        const payload = usersResponse.value?.data?.data ?? {}
        setUsers(Array.isArray(payload.results) ? payload.results : [])

        if (summaryResponse.status !== "fulfilled") {
          setSummary((prev) => ({
            ...prev,
            roleCounts: payload.summary?.roleCounts || prev.roleCounts,
            total: payload.pagination?.total ?? prev.total,
          }))
        }
      } else {
        setUsers([])
        setError((prev) => prev || usersResponse.reason?.response?.data?.message || "Unable to load user roster.")
      }
    } finally {
      setLoading(false)
    }
  }, [accessChecked, isSuperAdmin])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
    if (!statusMessage) return
    const timeout = window.setTimeout(() => setStatusMessage(null), 4500)
    return () => window.clearTimeout(timeout)
  }, [statusMessage])

  const roleCards = useMemo(() => {
    return ROLE_OPTIONS.map(({ value, label }) => {
      const stats = getRoleCounts(summary.roleCounts, value)
      const Icon = ROLE_ICONS[value] ?? Users
      return {
        roleId: value,
        label,
        icon: Icon,
        total: stats.total,
        verified: stats.verified,
        unverified: stats.unverified,
      }
    })
  }, [summary.roleCounts])

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const selectedRoleId = roleFilter === "all" ? null : Number(roleFilter)

    return users.filter((user) => {
      const matchesRole = !selectedRoleId || Number(user.roleid) === selectedRoleId

      if (!matchesRole) {
        return false
      }

      if (!normalizedSearch.length) {
        return true
      }

      const haystack = [
        user.firstname,
        user.lastname,
        composeFullName(user),
        user.email,
        user.contactnumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })
  }, [roleFilter, searchTerm, users])

  useEffect(() => {
    setPage(1)
  }, [roleFilter, searchTerm])

  const totalUsers = filteredUsers.length
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE
  const visibleUsers = useMemo(
    () => filteredUsers.slice(startIndex, endIndex),
    [filteredUsers, startIndex, endIndex],
  )
  const firstVisible = totalUsers === 0 ? 0 : startIndex + 1
  const lastVisible = Math.min(endIndex, totalUsers)
  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < totalPages

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const handleRoleUpdate = useCallback(
    async (user, nextRoleId) => {
      if (!isSuperAdmin) return

      const numericNextRoleId = Number(nextRoleId)
      if (!numericNextRoleId || numericNextRoleId === Number(user.roleid)) {
        return
      }

      setUpdatingUserId(user.userid)
      setStatusMessage(null)

      try {
        await axios.put(`/api/user/${user.userid}`, {
          roleId: numericNextRoleId,
        })

        setStatusMessage({
          type: "success",
          text: `${composeFullName(user)} is now ${ROLE_LABELS[numericNextRoleId]}.`,
        })

        fetchData()
      } catch (err) {
        const message = err.response?.data?.message || err.message || "Failed to update user role."
        setStatusMessage({ type: "error", text: message })
      } finally {
        setUpdatingUserId(null)
      }
    },
    [fetchData, isSuperAdmin]
  )

  if (!accessChecked) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center p-6 text-slate-700">
        <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-500 shadow-sm">
          <span className="loading loading-spinner loading-sm text-emerald-500" aria-hidden="true" />
          Verifying access…
        </div>
      </section>
    )
  }

  if (!isSuperAdmin) {
    return (
      <section className="p-6 text-slate-800">
        <div className="max-w-3xl space-y-6">
          <header className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Access Restricted
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
              <p className="font-medium text-emerald-800">Roles &amp; access management is limited to super administrators.</p>
              <p className="mt-2 text-emerald-700/80">
                Please contact a super administrator if you need to delegate approvals or adjust platform permissions.
              </p>
            </div>
          </header>
        </div>
      </section>
    )
  }

  return (
    <section className="px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Access Control
          </div>
          <div>
            <h1 className="text-2xl font-semibold uppercase tracking-[0.08em] text-emerald-800">Roles &amp; Access</h1>
            <p className="text-sm text-slate-500">
              Review who can publish, approve, and configure GeoAgriTech. Promote trusted staff, delegate approvals, and
              keep technician access aligned with field assignments.
            </p>
          </div>
        </header>

        {statusMessage ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              statusMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-600"
            }`}
          >
            {statusMessage.text}
          </div>
        ) : null}

        {error && !loading ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-600">Total accounts</p>
                <p className="text-2xl font-semibold text-slate-900 sm:text-[26px]">{summary.total}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
                <Users className="h-6 w-6" />
              </div>
            </div>
            <dl className="mt-4 flex items-center gap-4 text-xs text-slate-500">
              <div>
                <dt className="uppercase tracking-widest">Verified</dt>
                <dd className="text-emerald-600">{summary.verified}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-widest">Not verified</dt>
                <dd className="text-slate-600">{summary.unverified}</dd>
              </div>
            </dl>
          </article>

          {roleCards.map((card) => {
            const Icon = card.icon
            return (
              <article
                key={card.roleId}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-emerald-600">{card.label}</p>
                    <p className="text-2xl font-semibold text-slate-900 sm:text-[26px]">{card.total}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
                <dl className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                  <div>
                    <dt className="uppercase tracking-widest">Verified</dt>
                    <dd className="text-emerald-600">{card.verified}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-widest">Not verified</dt>
                    <dd className="text-slate-600">{card.unverified}</dd>
                  </div>
                </dl>
              </article>
            )
          })}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Team roster</h2>
              <p className="text-xs text-slate-500">
                Promote trusted admins, delegate approvals, or shift technicians to keep responsibilities aligned.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <form
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
                onSubmit={(event) => event.preventDefault()}
              >
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search by name or email"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
                />
              </form>

              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All roles</option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}s
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={fetchData}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 transition hover:bg-emerald-100"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      <div className="inline-flex items-center gap-2 text-sm">
                        <span className="loading loading-spinner loading-sm text-emerald-500" aria-hidden="true" />
                        Fetching roster…
                      </div>
                    </td>
                  </tr>
                ) : totalUsers ? (
                  visibleUsers.map((user) => {
                    const roleId = Number(user.roleid)
                    const roleLabel = ROLE_LABELS[roleId] ?? "Unknown"
                    const isSelf = Number(user.userid) === Number(currentUserId)

                    return (
                      <tr key={user.userid} className="hover:bg-slate-50">
                        <td className="px-4 py-3 align-middle">
                          <div className="font-medium text-slate-900">{composeFullName(user)}</div>
                          <div className="text-xs text-slate-500">ID: {user.userid}</div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className="text-slate-600">{user.email}</span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <select
                            value={roleId}
                            onChange={(event) => handleRoleUpdate(user, Number(event.target.value))}
                            disabled={isSelf || updatingUserId === user.userid}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${
                              user.is_verified
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {user.is_verified ? (
                              <BadgeCheck className="h-3.5 w-3.5" />
                            ) : (
                              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                            )}
                            {user.is_verified ? "Verified" : "Not verified"}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-right text-xs text-slate-500">
                          {isSelf ? "Current session" : roleLabel}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      No accounts match the selected filters yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalUsers > 0 ? (
            <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 shadow-sm sm:flex-row">
              <span>
                Showing {firstVisible === 0 ? 0 : `${firstVisible}-${lastVisible}`} of {totalUsers} team members
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => canGoPrevious && setPage((prev) => Math.max(1, prev - 1))}
                  disabled={!canGoPrevious}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1.5 font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Previous
                </button>
                <span className="text-slate-400">Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => canGoNext && setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={!canGoNext}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1.5 font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
