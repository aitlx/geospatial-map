import { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import { ClipboardList, CheckCircle2, XCircle, Clock, RotateCcw, FileStack, Search, Eye } from "lucide-react"

const STATUS_STYLES = {
  pending:
    "inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700",
  approved:
    "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700",
  rejected:
    "inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600",
}

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
]

const RECORD_FILTERS = [
  { id: "all", label: "All records" },
  { id: "barangay_yields", label: "Yield submissions" },
  { id: "crop_prices", label: "Market prices" },
]

const RECORD_TYPE_LABELS = {
  barangay_yields: "Yield Submission",
  crop_prices: "Crop Price",
}

const PAGE_SIZE = 15

const formatDateTime = (value) => {
  if (!value) return "—"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

const resolveSubmitter = (submission) => {
  if (!submission) return "Unknown submitter"

  const metadata = submission.metadata ?? {}

  const candidateNames = [
    submission.submitted_by_name,
    submission.submitted_by_full_name,
    metadata.submitted_by_name,
    metadata.submitted_by_full_name,
    metadata.submittedByName,
    metadata.submittedByFullName,
    metadata.recorded_by_name,
    metadata.recordedByName,
  ]

  const resolvedName = candidateNames.find((value) => typeof value === "string" && value.trim().length)
  if (resolvedName) {
    return resolvedName.trim()
  }

  const fallbackId = submission.submitted_by ?? metadata.submitted_by ?? metadata.recorded_by_user_id
  if (fallbackId) {
    return `User #${fallbackId}`
  }

  return "Unknown submitter"
}

export default function SubmissionReviews() {
  const [allSubmissions, setAllSubmissions] = useState([])
  const [filteredSubmissions, setFilteredSubmissions] = useState([])
  const [statusFilter, setStatusFilter] = useState("pending")
  const [recordFilter, setRecordFilter] = useState("all")
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [actioningId, setActioningId] = useState(null)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectError, setRejectError] = useState("")
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [viewTarget, setViewTarget] = useState(null)
  const [viewDetails, setViewDetails] = useState(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [viewError, setViewError] = useState("")
  const [viewDeleted, setViewDeleted] = useState(false)
  const [page, setPage] = useState(1)

  const fetchSubmissions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: "all" })
      const response = await axios.get(`/api/approvals/pending?${params.toString()}`)
      const payload = Array.isArray(response?.data?.data) ? response.data.data : []
  setAllSubmissions(payload)
  setPage(1)
      setError(null)
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Failed to load submissions."
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  useEffect(() => {
    const normalizedStatus = statusFilter.toLowerCase()
    const normalizedRecord = recordFilter.toLowerCase()
    const trimmedSearch = searchTerm.trim().toLowerCase()

    const next = allSubmissions.filter((submission) => {
      const submissionStatus = (submission.status || "").toLowerCase()
      const submissionRecordType = (submission.record_type || "").toLowerCase()

      if (normalizedStatus !== "all" && submissionStatus !== normalizedStatus) {
        return false
      }

      if (normalizedRecord !== "all" && submissionRecordType !== normalizedRecord) {
        return false
      }

      if (trimmedSearch) {
        const haystack = [
          submission.record_id?.toString() ?? "",
          submission.submitted_by_name ?? "",
          submission.status ?? "",
          submissionRecordType,
        ]
          .join(" ")
          .toLowerCase()

        if (!haystack.includes(trimmedSearch)) {
          return false
        }
      }

      return true
    })

    setFilteredSubmissions(next)
  }, [allSubmissions, recordFilter, searchTerm, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, recordFilter, searchTerm])

  const handleDecision = useCallback(
    async (submission, decision, options = {}) => {
      if (!submission?.record_type || !submission?.record_id) return

      const statusKey = (submission.status || "").toLowerCase()
      if (statusKey !== "pending") {
        return { success: false, message: "Only pending submissions can be updated." }
      }

      const submissionKey = `${submission.record_type}-${submission.record_id}`
      setActioningId(submissionKey)

      try {
        setError(null)
        if (decision === "reject") {
          const reason = options?.reason?.trim()
          if (!reason) {
            throw new Error("Please provide a rejection reason before submitting.")
          }

          await axios.put(`/api/approvals/reject/${submission.record_type}/${submission.record_id}`, {
            reason,
          })
        } else {
          await axios.put(`/api/approvals/approve/${submission.record_type}/${submission.record_id}`)
        }

        await fetchSubmissions()
        return { success: true }
      } catch (err) {
        const message =
          err.response?.data?.message ||
          err.message ||
          `Failed to ${decision} submission ${submission.record_type}/${submission.record_id}`
        setError(message)
        return { success: false, message }
      } finally {
        setActioningId(null)
      }
    },
    [fetchSubmissions],
  )

  const openRejectModal = (submission) => {
    if (!submission) return
    const statusKey = (submission.status || "").toLowerCase()
    if (statusKey !== "pending") return

    setRejectTarget(submission)
    setRejectReason("")
    setRejectError("")
    setRejectModalOpen(true)
  }

  const closeRejectModal = () => {
    if (actioningId) return
    setRejectModalOpen(false)
    setRejectTarget(null)
    setRejectReason("")
    setRejectError("")
  }

  const confirmReject = async () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      setRejectError("Please provide a reason for rejecting this submission.")
      return
    }

    const result = await handleDecision(rejectTarget, "reject", { reason: rejectReason })

    if (result?.success) {
      setRejectModalOpen(false)
      setRejectTarget(null)
      setRejectReason("")
      setRejectError("")
    } else if (result?.message) {
      setRejectError(result.message)
    }
  }

  const pendingCount = useMemo(
    () => allSubmissions.filter((submission) => (submission.status || "").toLowerCase() === "pending").length,
    [allSubmissions],
  )

  const approvedCount = useMemo(
    () => allSubmissions.filter((submission) => (submission.status || "").toLowerCase() === "approved").length,
    [allSubmissions],
  )

  const rejectedCount = useMemo(
    () => allSubmissions.filter((submission) => (submission.status || "").toLowerCase() === "rejected").length,
    [allSubmissions],
  )

  const pendingMarketCount = useMemo(
    () =>
      allSubmissions.filter(
        (submission) =>
          (submission.status || "").toLowerCase() === "pending" &&
          (submission.record_type || "").toLowerCase() === "crop_prices",
      ).length,
    [allSubmissions],
  )

  const showEmptyState = !loading && !error && filteredSubmissions.length === 0

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    setSearchTerm(searchInput)
  }

  const resetSearch = () => {
    setSearchInput("")
    setSearchTerm("")
  }

  const showDecisionControls = statusFilter === "pending" || statusFilter === "all"
  const tableColumnCount = showDecisionControls ? 7 : 6
  const totalSubmissions = filteredSubmissions.length
  const totalPages = Math.max(1, Math.ceil(totalSubmissions / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE
  const visibleSubmissions = useMemo(
    () => filteredSubmissions.slice(startIndex, endIndex),
    [filteredSubmissions, startIndex, endIndex],
  )
  const firstVisible = totalSubmissions === 0 ? 0 : startIndex + 1
  const lastVisible = Math.min(endIndex, totalSubmissions)
  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < totalPages

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const loadSubmissionDetails = useCallback(async (submission) => {
    if (!submission?.record_type || !submission?.record_id) return null

    const type = submission.record_type.toLowerCase()
    const id = submission.record_id

    try {
      if (type === "barangay_yields" || type === "barangay_yield") {
        const response = await axios.get(`/api/barangay-yields/${id}`)
        return response.data?.data || null
      }

      if (type === "crop_prices" || type === "barangay_crop_prices") {
        const response = await axios.get(`/api/barangay-crop-prices/${id}`)
        return response.data?.data || null
      }
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Unable to load submission details"
      const enhancedError = new Error(message)
      enhancedError.statusCode = error?.response?.status ?? error?.statusCode ?? null
      enhancedError.code = error?.response?.data?.code ?? error?.code
      throw enhancedError
    }

    return null
  }, [])

  const openViewModal = useCallback(
    async (submission) => {
      if (!submission) return

      setViewModalOpen(true)
      setViewTarget(submission)
      setViewDetails(null)
      setViewError("")
      setViewDeleted(false)
      setViewLoading(true)

      try {
        const details = await loadSubmissionDetails(submission)
        setViewDetails(details)
      } catch (error) {
        const message = error?.message || "Unable to load submission details"
        const notFound = Boolean(error?.statusCode === 404 || /not\s+found/i.test(message))
        setViewDeleted(notFound)
        setViewError(notFound ? "This record is no longer available. Displaying submitted metadata." : message)
      } finally {
        setViewLoading(false)
      }
    },
    [loadSubmissionDetails]
  )

  const closeViewModal = () => {
    if (viewLoading) return
    setViewModalOpen(false)
    setViewTarget(null)
    setViewDetails(null)
    setViewError("")
    setViewDeleted(false)
  }

  const buildDetailRows = useCallback(() => {
    if (!viewTarget) return []

    const metadata = viewTarget.metadata ?? {}
    const details = viewDetails ?? {}
    const type = (viewTarget.record_type || "").toLowerCase()

    const formatValue = (value) => {
      if (value === undefined || value === null || value === "") {
        return "—"
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return value.toLocaleString()
      }
      return value
    }

    const pick = (...keys) => {
      for (const key of keys) {
        const detailValue = details[key]
        if (detailValue !== undefined && detailValue !== null && detailValue !== "") {
          return formatValue(detailValue)
        }
        const metaValue = metadata[key]
        if (metaValue !== undefined && metaValue !== null && metaValue !== "") {
          return formatValue(metaValue)
        }
      }
      return "—"
    }

    if (type === "barangay_yields" || type === "barangay_yield") {
      return [
        { label: "Barangay", value: pick("barangay", "barangay_name", "barangay_id") },
        { label: "Crop", value: pick("crop", "crop_name", "crop_id") },
        { label: "Year", value: pick("year", "yield_year") },
        { label: "Season", value: pick("season", "yield_season") },
        {
          label: "Total yield (kg)",
          value: pick("total_yield", "yield_total_yield"),
        },
        {
          label: "Area planted (ha)",
          value: pick("total_area_planted_ha", "area"),
        },
        {
          label: "Yield per hectare (kg/ha)",
          value: pick("yield_per_hectare"),
        },
      ]
    }

    if (type === "crop_prices" || type === "barangay_crop_prices") {
      return [
        { label: "Barangay", value: pick("barangay", "barangay_id") },
        { label: "Crop", value: pick("crop", "crop_id") },
        { label: "Year", value: pick("year") },
        { label: "Season", value: pick("season") },
        {
          label: "Price per kilogram",
          value: pick("price_per_kg"),
        },
        {
          label: "Recorded by",
          value: pick(
            "submitted_by_name",
            "submitted_by_full_name",
            "recorded_by_name",
            "recorded_by_user_name",
            "submitted_by",
            "recorded_by_user_id"
          ),
        },
      ]
    }

    return Object.entries({ ...metadata, ...details }).map(([label, value]) => ({
      label,
      value: formatValue(value),
    }))
  }, [viewDetails, viewTarget])

  const detailRows = buildDetailRows()

  return (
    <section className="space-y-6 px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ClipboardList size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold uppercase tracking-[0.08em] text-emerald-800">Submission Reviews</h1>
              <p className="text-sm text-slate-500">
                Review approvals across pending market prices and barangay yield submissions.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm"
          >
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search by ID, name, or status"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={resetSearch}
                className="text-xs text-emerald-600 transition-colors hover:text-emerald-500"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="btn btn-sm border-emerald-500 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
              disabled={loading}
            >
              Apply
            </button>
          </form>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm text-slate-500">Pending Reviews</p>
            <p className="text-2xl font-semibold text-slate-900 sm:text-[26px]">{pendingCount}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
            <Clock size={24} />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm text-slate-500">Approved Records</p>
            <p className="text-2xl font-semibold text-slate-900 sm:text-[26px]">{approvedCount}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={24} />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm text-slate-500">Rejected Decisions</p>
            <p className="text-2xl font-semibold text-slate-900 sm:text-[26px]">{rejectedCount}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
            <XCircle size={24} />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm text-slate-500">Pending Market Prices</p>
            <p className="text-2xl font-semibold text-slate-900 sm:text-[26px]">{pendingMarketCount}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
            <FileStack size={24} />
          </div>
        </article>
      </section>

      <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-6">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Approval Activity</h2>
              <p className="text-sm text-slate-500">Switch between statuses and record types to review decisions.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => {
                const isActive = statusFilter === filter.id
                return (
                  <button
                    key={filter.id}
                    type="button"
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-600"
                    }`}
                    onClick={() => setStatusFilter(filter.id)}
                    disabled={loading && !isActive}
                  >
                    {filter.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {RECORD_FILTERS.map((filter) => {
              const isActive = recordFilter === filter.id
              return (
                <button
                  key={filter.id}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-600"
                  }`}
                  onClick={() => setRecordFilter(filter.id)}
                  disabled={loading && !isActive}
                >
                  {filter.label}
                </button>
              )
            })}

            <button
              type="button"
              onClick={fetchSubmissions}
              className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50"
              disabled={loading}
            >
              <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh list
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-b-2xl">
          <table className="min-w-full table-fixed text-sm text-slate-700">
            <thead className="bg-slate-50 text-[0.62rem] uppercase tracking-[0.25em] text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-semibold">Submission</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Submitted By</th>
                <th className="px-4 py-2.5 font-semibold">Submitted At</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="w-[110px] px-3 py-2.5 text-center font-semibold">Review</th>
                {showDecisionControls ? <th className="w-[150px] px-3 py-2.5 text-center font-semibold">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={tableColumnCount} className="py-10 text-center text-slate-400">
                    <span className="loading loading-spinner loading-md text-emerald-500" aria-hidden="true" />
                    <span className="ml-2 align-middle">Fetching submissions…</span>
                  </td>
                </tr>
              ) : showEmptyState ? (
                <tr>
                  <td colSpan={tableColumnCount} className="py-8 text-center text-slate-400">
                    No submissions match the selected filters yet.
                  </td>
                </tr>
              ) : (
                visibleSubmissions.map((submission) => {
                  const statusKey = (submission.status || "").toLowerCase()
                  const badgeClass =
                    STATUS_STYLES[statusKey] ??
                    "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                  const recordLabel = RECORD_TYPE_LABELS[submission.record_type] || submission.record_type
                  const submitterLabel = resolveSubmitter(submission)
                  const submissionKey = `${submission.record_type}-${submission.record_id}`
                  const isActioning = actioningId === submissionKey
                  const isPending = statusKey === "pending"
                  const disableApprove = isActioning || !isPending

                  return (
                    <tr key={submissionKey} className="bg-white/70 transition hover:bg-emerald-50/60">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm font-medium text-slate-900">{submission.record_id}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">
                        <span className="block max-w-[12rem] truncate" title={recordLabel}>
                          {recordLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">
                        <span className="block max-w-[14rem] truncate" title={submitterLabel}>
                          {submitterLabel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-600">{formatDateTime(submission.submitted_at)}</td>
                      <td className="px-4 py-2.5">
                        <span className={badgeClass}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current/70"></span>
                          {submission.status ?? "Unknown"}
                        </span>
                      </td>
                      <td className="w-[110px] px-3 py-2.5 text-center">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-600 transition hover:border-emerald-300 hover:bg-emerald-50"
                          onClick={() => openViewModal(submission)}
                        >
                          <Eye size={16} />
                          <span className="sr-only">View details</span>
                        </button>
                      </td>
                      {showDecisionControls ? (
                        <td className="w-[150px] px-3 py-2.5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              className={`inline-flex h-9 items-center gap-1 rounded-full border border-emerald-300 px-3 text-xs font-semibold transition-colors ${
                                disableApprove
                                  ? "cursor-not-allowed bg-emerald-100 text-emerald-400"
                                  : "bg-emerald-500 text-white hover:bg-emerald-600"
                              }`}
                              onClick={() => handleDecision(submission, "approve")}
                              disabled={disableApprove}
                            >
                              {isActioning && isPending ? (
                                <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                              ) : (
                                <CheckCircle2 size={16} />
                              )}
                              Approve
                            </button>
                            <button
                              type="button"
                              className={`inline-flex h-9 items-center gap-1 rounded-full border border-rose-200 px-3 text-xs font-semibold transition-colors ${
                                isPending
                                  ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                                  : "cursor-not-allowed bg-rose-100 text-rose-300"
                              }`}
                              onClick={() => openRejectModal(submission)}
                              disabled={!isPending}
                            >
                              {isActioning && isPending ? (
                                <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                              ) : (
                                <XCircle size={16} />
                              )}
                              Reject
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </article>

      {totalSubmissions > 0 ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm sm:flex-row">
          <span>
            Showing {firstVisible === 0 ? 0 : `${firstVisible}-${lastVisible}`} of {totalSubmissions} submissions
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

      {viewModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-3 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">Submission details</h3>
                <p className="text-xs text-slate-500">Review the record shared by the field team.</p>
              </div>
              <button
                type="button"
                className="rounded-lg px-3 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                onClick={closeViewModal}
                disabled={viewLoading}
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4 text-sm text-slate-700">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Submission</p>
                  <p className="font-mono text-sm text-slate-900">{viewTarget?.record_id ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Type</p>
                  <p className="text-sm font-medium text-slate-900">{RECORD_TYPE_LABELS[viewTarget?.record_type] || viewTarget?.record_type || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Status</p>
                  <p className="text-sm font-medium capitalize text-slate-900">{viewTarget?.status || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Submitted by</p>
                  <p className="text-sm font-medium text-slate-900">{viewTarget ? resolveSubmitter(viewTarget) : "—"}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Submitted at</p>
                  <p className="text-sm font-medium text-slate-900">{formatDateTime(viewTarget?.submitted_at)}</p>
                </div>
              </div>

              {viewDeleted ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  <p className="font-medium">This record has already been removed from the source tables.</p>
                  <p className="mt-1 text-amber-600/80">
                    {viewError || "Only the metadata captured at submission time is available."}
                  </p>
                </div>
              ) : null}

              {!viewDeleted && viewError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-600">
                  {viewError}
                </div>
              ) : null}

              {viewLoading ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-600">
                  <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                  Fetching submission details…
                </div>
              ) : detailRows.length > 0 ? (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {detailRows.map((row) => (
                    <div key={`${row.label}-${row.value}`} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-[11px] uppercase tracking-[0.26em] text-slate-400">{row.label}</dt>
                      <dd className="mt-1 break-words text-sm font-medium text-slate-900">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  No additional details were provided for this submission.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800"
                onClick={closeViewModal}
                disabled={viewLoading}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Reject submission</h3>
                <p className="text-sm text-slate-500">
                  Provide a short reason so the technician can address the issue.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg px-3 py-1 text-sm text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                onClick={closeRejectModal}
              >
                Close
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Submission</span>
                  <span className="font-mono text-slate-900">{rejectTarget?.record_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="text-slate-900">{RECORD_TYPE_LABELS[rejectTarget?.record_type] || rejectTarget?.record_type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Submitted by</span>
                  <span className="text-slate-900">{rejectTarget ? resolveSubmitter(rejectTarget) : "—"}</span>
                </div>
              </div>

              <label className="flex flex-col gap-2 text-sm text-slate-700">
                <span>Rejection reason</span>
                <textarea
                  className="h-28 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="Let the technician know what needs to be fixed"
                  value={rejectReason}
                  onChange={(event) => {
                    setRejectReason(event.target.value)
                    if (rejectError) setRejectError("")
                  }}
                  maxLength={400}
                />
                <span className="text-xs text-slate-400">{rejectReason.length}/400 characters</span>
              </label>

              {rejectError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-600">
                  {rejectError}
                </div>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800"
                onClick={closeRejectModal}
                disabled={Boolean(actioningId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-rose-200"
                onClick={confirmReject}
                disabled={Boolean(actioningId)}
              >
                {actioningId ? <span className="loading loading-spinner loading-xs" aria-hidden="true" /> : null}
                Reject submission
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
