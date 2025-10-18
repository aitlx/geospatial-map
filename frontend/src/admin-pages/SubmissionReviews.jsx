import { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import { ClipboardList, CheckCircle2, XCircle, Clock, RotateCcw, FileStack, Search, Eye } from "lucide-react"

// submission review styles and filters
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
  { id: "barangay_yields", label: "Yields" },
  { id: "crop_prices", label: "Prices" },
]

const RECORD_TYPE_LABELS = {
  barangay_yields: "Yield Submission",
  crop_prices: "Crop Price",
}

// page size for submission lists
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
  if (resolvedName) return resolvedName.trim()
  const fallbackId = submission.submitted_by ?? metadata.submitted_by ?? metadata.recorded_by_user_id
  if (fallbackId) return `User #${fallbackId}`
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
  const lookupCacheRef = useState(() => ({ users: {}, barangays: null, crops: null }))[0]
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

      if (normalizedStatus !== "all" && submissionStatus !== normalizedStatus) return false
      if (normalizedRecord !== "all" && submissionRecordType !== normalizedRecord) return false

      if (trimmedSearch) {
        const haystack = [
          submission.record_id?.toString() ?? "",
          submission.submitted_by_name ?? "",
          submission.status ?? "",
          submissionRecordType,
        ].join(" ").toLowerCase()
        if (!haystack.includes(trimmedSearch)) return false
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
          if (!reason) throw new Error("Please provide a rejection reason before submitting.")
          await axios.put(`/api/approvals/reject/${submission.record_type}/${submission.record_id}`, { reason })
        } else {
          await axios.put(`/api/approvals/approve/${submission.record_type}/${submission.record_id}`)
        }
        await fetchSubmissions()
        return { success: true }
      } catch (err) {
        const message = err.response?.data?.message || err.message || `Failed to ${decision} submission`
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
      const message = error.response?.data?.message || error.response?.data?.error || error.message || "Unable to load submission details"
      const enhancedError = new Error(message)
      enhancedError.statusCode = error?.response?.status ?? error?.statusCode ?? null
      enhancedError.code = error?.response?.data?.code ?? error?.code
      throw enhancedError
    }
    return null
  }, [])

  // helpers to fetch and cache lookup data
  const fetchUserName = useCallback(async (userId) => {
    if (!userId) return null
    const id = Number(userId)
    if (!Number.isFinite(id)) return null
    if (lookupCacheRef.users[id]) return lookupCacheRef.users[id]
    try {
      const resp = await axios.get(`/api/user/${id}`)
      const payload = resp?.data?.data ?? resp?.data ?? null
      const name = payload ? (payload.firstname || payload.name || payload.full_name || payload.email) : null
      lookupCacheRef.users[id] = name || `User #${id}`
      return lookupCacheRef.users[id]
    } catch {
      lookupCacheRef.users[id] = `User #${id}`
      return lookupCacheRef.users[id]
    }
  }, [lookupCacheRef])

  const fetchBarangays = useCallback(async () => {
    if (lookupCacheRef.barangays) return lookupCacheRef.barangays
    try {
      const resp = await axios.get('/api/barangays/dropdown')
      const list = Array.isArray(resp?.data?.data) ? resp.data.data : []
      lookupCacheRef.barangays = list
      return list
    } catch {
      lookupCacheRef.barangays = []
      return []
    }
  }, [lookupCacheRef])

  const fetchCrops = useCallback(async () => {
    if (lookupCacheRef.crops) return lookupCacheRef.crops
    try {
      const resp = await axios.get('/api/crops/dropdown')
      const list = Array.isArray(resp?.data?.data) ? resp.data.data : []
      lookupCacheRef.crops = list
      return list
    } catch {
      lookupCacheRef.crops = []
      return []
    }
  }, [lookupCacheRef])

  const resolveAndPatchNames = useCallback(async (details = {}, submission = {}) => {
    // combine metadata and details to search for ids
    const metadata = submission.metadata ?? {}
    const candidates = { ...metadata, ...details }
    const updates = {}

    // resolve barangay id
    const barangayId = candidates.barangay_id ?? candidates.barangay
    if (barangayId) {
      const barangays = await fetchBarangays()
      const found = barangays.find((b) => Number(b.id) === Number(barangayId) || String(b.id) === String(barangayId))
      if (found) updates.barangay_name = found.name ?? found.label ?? found.text ?? found.barangay_name
    }

    // resolve crop id
    const cropId = candidates.crop_id ?? candidates.crop
    if (cropId) {
      const crops = await fetchCrops()
      const found = crops.find((c) => Number(c.id) === Number(cropId) || String(c.id) === String(cropId))
      if (found) updates.crop_name = found.name ?? found.label ?? found.text ?? found.crop_name
    }

    // resolve recorded/submitted/approved/performed user ids
    const userKeys = [
      'performed_by', 'performed_by_user_id', 'recorded_by', 'recorded_by_user_id', 'submitted_by', 'submitted_by_user_id', 'approved_by', 'reviewed_by'
    ]
    for (const key of userKeys) {
      const val = candidates[key]
      if (!val) continue
      // if val looks numeric or object with id
      const id = typeof val === 'object' && val.id ? val.id : val
      if (!id) continue
      const name = await fetchUserName(id)
      if (name) {
        // write into updates with common name keys
        if (/performed|approved|reviewed/.test(key)) updates.approved_by_name = name
        if (/recorded|submitted/.test(key)) updates.recorded_by_name = name
      }
    }

    if (Object.keys(updates).length) {
      const merged = { ...(details || {}), ...updates }
      setViewDetails(merged)
    }
  }, [fetchBarangays, fetchCrops, fetchUserName])

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
          // attempt to resolve names for any numeric ids present and patch the details
          try {
            await resolveAndPatchNames(details, submission)
          } catch {
            // ignore lookup failures - we'll still show available metadata
          }
      } catch (error) {
        const message = error?.message || "Unable to load submission details"
        const notFound = Boolean(error?.statusCode === 404 || /not\s+found/i.test(message))
        setViewDeleted(notFound)
        setViewError(notFound ? "This record is no longer available. Displaying submitted metadata." : message)
      } finally {
        setViewLoading(false)
      }
    },
    [loadSubmissionDetails, resolveAndPatchNames]
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
      if (value === undefined || value === null || value === "") return "—"

      // handle objects (relations or nested payloads)
      if (typeof value === "object") {
        if (Array.isArray(value)) return value.map(formatValue).join(", ")
        // prefer common name-like fields
        const nameFields = [
          "name",
          "full_name",
          "fullname",
          "submitted_by_full_name",
          "submitted_by_name",
          "recorded_by_name",
          "label",
          "title",
          "barangay_name",
          "crop_name",
        ]
        for (const f of nameFields) {
          if (value[f]) return String(value[f])
        }
        if (value.id !== undefined && value.id !== null) return `#${value.id}`
        try {
          return JSON.stringify(value)
        } catch {
          return String(value)
        }
      }

      if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString()
      return value
    }

    const pick = (...keys) => {
      for (const key of keys) {
        const detailValue = details[key]
        if (detailValue !== undefined && detailValue !== null && detailValue !== "") return formatValue(detailValue)
        const metaValue = metadata[key]
        if (metaValue !== undefined && metaValue !== null && metaValue !== "") return formatValue(metaValue)
      }
      return "—"
    }

    if (type === "barangay_yields" || type === "barangay_yield") {
      const resolveRecordedBy = () => {
        // prefer explicit submitter name from the top-level submission
        const submitterName = resolveSubmitter(viewTarget)
        if (submitterName && !/^User\s+#/i.test(submitterName) && submitterName !== "Unknown submitter") return submitterName
        // fall back to detail or metadata fields
        return pick(
          "submitted_by_name",
          "submitted_by_full_name",
          "recorded_by_name",
          "recorded_by_user_name",
          "submitted_by",
          "recorded_by_user_id",
        )
      }

      return [
        // prefer explicit name fields first, then object or id
        { label: "Barangay", value: pick("barangay_name", "barangay", "barangay_id") },
        { label: "Crop", value: pick("crop_name", "crop", "crop_id") },
        { label: "Year", value: pick("year", "yield_year") },
        { label: "Season", value: pick("season", "yield_season") },
        { label: "Total yield (kg)", value: pick("total_yield", "yield_total_yield") },
        { label: "Area planted (ha)", value: pick("total_area_planted_ha", "area") },
        { label: "Yield per hectare (kg/ha)", value: pick("yield_per_hectare") },
        { label: "Recorded by", value: resolveRecordedBy() },
      ]
    }

    if (type === "crop_prices" || type === "barangay_crop_prices") {
      const resolveRecordedBy = () => {
        const submitterName = resolveSubmitter(viewTarget)
        if (submitterName && !/^User\s+#/i.test(submitterName) && submitterName !== "Unknown submitter") return submitterName
        return pick(
          "submitted_by_name",
          "submitted_by_full_name",
          "recorded_by_name",
          "recorded_by_user_name",
          "submitted_by",
          "recorded_by_user_id",
        )
      }

      return [
        { label: "Barangay", value: pick("barangay_name", "barangay", "barangay_id") },
        { label: "Crop", value: pick("crop_name", "crop", "crop_id") },
        { label: "Year", value: pick("year") },
        { label: "Season", value: pick("season") },
        { label: "Price per kilogram", value: pick("price_per_kg") },
        { label: "Recorded by", value: resolveRecordedBy() },
      ]
    }

    return Object.entries({ ...metadata, ...details }).map(([label, value]) => ({
      label,
      value: formatValue(value),
    }))
  }, [viewDetails, viewTarget])

  const detailRows = buildDetailRows()

  return (
    <section className="space-y-4 sm:space-y-6 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 text-slate-800">
      <header className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex-shrink-0">
              <ClipboardList size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-semibold uppercase tracking-wider text-emerald-800 truncate">Submission Reviews</h1>
              <p className="text-xs sm:text-sm text-slate-500">Review pending submissions</p>
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex w-full items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-3 sm:px-4 py-2 shadow-sm">
            <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <input
              type="search"
              placeholder="Search..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="flex-1 bg-transparent text-xs sm:text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none min-w-0"
            />
            {searchTerm && (
              <button type="button" onClick={resetSearch} className="text-xs text-emerald-600 transition-colors hover:text-emerald-500 flex-shrink-0">
                Clear
              </button>
            )}
            <button type="submit" className="text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-lg border-emerald-500 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 flex-shrink-0" disabled={loading}>
              Apply
            </button>
          </form>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-rose-600">
            {error}
          </div>
        )}
      </header>

      <section className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <article className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-slate-500 truncate">Pending</p>
            <p className="text-xl sm:text-2xl font-semibold text-slate-900">{pendingCount}</p>
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 flex-shrink-0">
            <Clock size={18} className="sm:w-6 sm:h-6" />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-slate-500 truncate">Approved</p>
            <p className="text-xl sm:text-2xl font-semibold text-slate-900">{approvedCount}</p>
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 flex-shrink-0">
            <CheckCircle2 size={18} className="sm:w-6 sm:h-6" />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-slate-500 truncate">Rejected</p>
            <p className="text-xl sm:text-2xl font-semibold text-slate-900">{rejectedCount}</p>
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 flex-shrink-0">
            <XCircle size={18} className="sm:w-6 sm:h-6" />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-slate-500 truncate">Market</p>
            <p className="text-xl sm:text-2xl font-semibold text-slate-900">{pendingMarketCount}</p>
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 flex-shrink-0">
            <FileStack size={18} className="sm:w-6 sm:h-6" />
          </div>
        </article>
      </section>

      <article className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 sm:gap-4 border-b border-slate-200 p-3 sm:p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-base sm:text-xl font-semibold text-slate-900">Approval Activity</h2>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {STATUS_FILTERS.map((filter) => {
                const isActive = statusFilter === filter.id
                return (
                  <button
                    key={filter.id}
                    type="button"
                    className={`rounded-full border px-2.5 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                      isActive ? "border-emerald-500 bg-emerald-500 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-600"
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

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {RECORD_FILTERS.map((filter) => {
              const isActive = recordFilter === filter.id
              return (
                <button
                  key={filter.id}
                  type="button"
                  className={`rounded-full border px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium transition-colors ${
                    isActive ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-600"
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
              className="flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50"
              disabled={loading}
            >
              <RotateCcw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm text-slate-700">
            <thead className="bg-slate-50 text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-500">
              <tr className="text-left">
                <th className="px-2 sm:px-4 py-2 sm:py-2.5 font-semibold whitespace-nowrap">ID</th>
                <th className="px-2 sm:px-4 py-2 sm:py-2.5 font-semibold whitespace-nowrap">Type</th>
                <th className="px-2 sm:px-4 py-2 sm:py-2.5 font-semibold whitespace-nowrap hidden md:table-cell">Submitter</th>
                <th className="px-2 sm:px-4 py-2 sm:py-2.5 font-semibold whitespace-nowrap hidden lg:table-cell">Date</th>
                <th className="px-2 sm:px-4 py-2 sm:py-2.5 font-semibold whitespace-nowrap">Status</th>
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-center font-semibold whitespace-nowrap">View</th>
                {showDecisionControls && <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-center font-semibold whitespace-nowrap">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 sm:py-10 text-center text-slate-400">
                    <span className="inline-block h-5 w-5 sm:h-6 sm:w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    <span className="ml-2 text-xs sm:text-sm">Loading...</span>
                  </td>
                </tr>
              ) : showEmptyState ? (
                <tr>
                  <td colSpan="7" className="py-6 sm:py-8 text-center text-xs sm:text-sm text-slate-400">
                    No submissions found
                  </td>
                </tr>
              ) : (
                visibleSubmissions.map((submission) => {
                  const statusKey = (submission.status || "").toLowerCase()
                  const badgeClass = STATUS_STYLES[statusKey] ?? "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                  const recordLabel = RECORD_TYPE_LABELS[submission.record_type] || submission.record_type
                  const submitterLabel = resolveSubmitter(submission)
                  const submissionKey = `${submission.record_type}-${submission.record_id}`
                  const isActioning = actioningId === submissionKey
                  const isPending = statusKey === "pending"
                  const disableApprove = isActioning || !isPending

                  return (
                    <tr key={submissionKey} className="bg-white/70 transition hover:bg-emerald-50/60">
                      <td className="px-2 sm:px-4 py-2 sm:py-2.5 font-mono text-xs sm:text-sm font-medium text-slate-900 whitespace-nowrap">{submission.record_id}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-600">
                        <span className="block max-w-[80px] sm:max-w-[120px] truncate" title={recordLabel}>{recordLabel}</span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-600 hidden md:table-cell">
                        <span className="block max-w-[120px] sm:max-w-[160px] truncate" title={submitterLabel}>{submitterLabel}</span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-600 hidden lg:table-cell whitespace-nowrap">{formatDateTime(submission.submitted_at)}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-2.5">
                        <span className={badgeClass}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current/70"></span>
                          <span className="hidden sm:inline">{submission.status ?? "Unknown"}</span>
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-center">
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-600 transition hover:border-emerald-300 hover:bg-emerald-50"
                          onClick={() => openViewModal(submission)}
                        >
                          <Eye size={14} className="sm:w-4 sm:h-4" />
                        </button>
                      </td>
                      {showDecisionControls && (
                        <td className="px-2 sm:px-3 py-2 sm:py-2.5">
                          <div className="flex items-center justify-center gap-1sm:gap-2">
                            <button
                              type="button"
                              className={`inline-flex h-7 sm:h-9 items-center gap-1 rounded-full border border-emerald-300 px-2 sm:px-3 text-[10px] sm:text-xs font-semibold transition-colors ${
                                disableApprove ? "cursor-not-allowed bg-emerald-100 text-emerald-400" : "bg-emerald-500 text-white hover:bg-emerald-600"
                              }`}
                              onClick={() => handleDecision(submission, "approve")}
                              disabled={disableApprove}
                            >
                              {isActioning && isPending ? (
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                              ) : (
                                <CheckCircle2 size={12} className="sm:w-4 sm:h-4" />
                              )}
                              <span className="hidden sm:inline">Approve</span>
                            </button>
                            <button
                              type="button"
                              className={`inline-flex h-7 sm:h-9 items-center gap-1 rounded-full border border-rose-200 px-2 sm:px-3 text-[10px] sm:text-xs font-semibold transition-colors ${
                                isPending ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "cursor-not-allowed bg-rose-100 text-rose-300"
                              }`}
                              onClick={() => openRejectModal(submission)}
                              disabled={!isPending}
                            >
                              {isActioning && isPending ? (
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-rose-600 border-t-transparent" />
                              ) : (
                                <XCircle size={12} className="sm:w-4 sm:h-4" />
                              )}
                              <span className="hidden sm:inline">Reject</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </article>

      {totalSubmissions > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs text-slate-500 shadow-sm">
          <span className="text-center sm:text-left">
            Showing {firstVisible === 0 ? 0 : `${firstVisible}-${lastVisible}`} of {totalSubmissions}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => canGoPrevious && setPage((prev) => Math.max(1, prev - 1))}
              disabled={!canGoPrevious}
              className="inline-flex items-center gap-1 sm:gap-2 rounded-full border border-slate-200 px-2 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Prev
            </button>
            <span className="text-slate-400 text-[10px] sm:text-xs">{currentPage}/{totalPages}</span>
            <button
              type="button"
              onClick={() => canGoNext && setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={!canGoNext}
              className="inline-flex items-center gap-1 sm:gap-2 rounded-full border border-slate-200 px-2 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      )}

  {/* view modal */}
      {viewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-3 py-4 sm:px-4 sm:py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 sm:px-5 py-2.5 sm:py-3 flex-shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-semibold text-slate-900">Details</h3>
                <p className="text-[10px] sm:text-xs text-slate-500">Review submission</p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 sm:px-3 py-1 text-[10px] sm:text-xs text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 flex-shrink-0"
                onClick={closeViewModal}
                disabled={viewLoading}
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto px-4 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm text-slate-700 flex-1">
              <div className="grid gap-2 sm:gap-3 grid-cols-2">
                <div>
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-400">ID</p>
                  <p className="font-mono text-xs sm:text-sm text-slate-900 truncate">{viewTarget?.record_id ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-400">Type</p>
                  <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">{RECORD_TYPE_LABELS[viewTarget?.record_type] || viewTarget?.record_type || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-400">Status</p>
                  <p className="text-xs sm:text-sm font-medium capitalize text-slate-900">{viewTarget?.status || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-400">By</p>
                  <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">
                    {viewTarget ? (
                      // show approver if actioned, otherwise submitter or a friendly message
                      (resolveApprover(viewTarget) || (viewTarget.status && viewTarget.status.toLowerCase() !== "pending")
                        ? resolveApprover(viewTarget) || "—"
                        : "no action has been taken yet")
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-400">Date</p>
                  <p className="text-xs sm:text-sm font-medium text-slate-900">{formatDateTime(viewTarget?.submitted_at)}</p>
                </div>
              </div>

              {viewDeleted && (
                <div className="rounded-lg sm:rounded-xl border border-amber-200 bg-amber-50 px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs text-amber-700 mt-3">
                  <p className="font-medium">Record removed</p>
                  <p className="mt-1 text-amber-600/80">{viewError || "Only metadata available."}</p>
                </div>
              )}

              {!viewDeleted && viewError && (
                <div className="rounded-lg sm:rounded-xl border border-rose-200 bg-rose-50 px-3 sm:px-4 py-2 text-[10px] sm:text-xs text-rose-600 mt-3">
                  {viewError}
                </div>
              )}

              {viewLoading ? (
                <div className="flex items-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl border border-emerald-200 bg-emerald-50 px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs text-emerald-600 mt-3">
                  <span className="inline-block h-3 w-3 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  Loading...
                </div>
              ) : detailRows.length > 0 ? (
                <dl className="grid gap-2 sm:gap-3 grid-cols-2 mt-3">
                  {detailRows.map((row) => (
                    <div key={`${row.label}-${row.value}`} className="rounded-lg sm:rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-2 sm:py-3">
                      <dt className="text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-400 truncate">{row.label}</dt>
                      <dd className="mt-1 break-words text-xs sm:text-sm font-medium text-slate-900">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs text-slate-500 mt-3">
                  No details available
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 sm:gap-3 border-t border-slate-200 bg-slate-50 px-4 sm:px-5 py-2 sm:py-3 flex-shrink-0">
              <button
                type="button"
                className="rounded-lg sm:rounded-xl border border-slate-200 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800"
                onClick={closeViewModal}
                disabled={viewLoading}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

  {/* reject modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm px-3 sm:px-4">
          <div className="w-full max-w-lg overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 sm:px-6 py-3 sm:py-4">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-900">Reject</h3>
                <p className="text-xs sm:text-sm text-slate-500">Provide a reason</p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                onClick={closeRejectModal}
              >
                Close
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4 px-4 sm:px-6 py-4 sm:py-5">
              <div className="grid gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ID</span>
                  <span className="font-mono text-slate-900">{rejectTarget?.record_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="text-slate-900 truncate ml-2">{RECORD_TYPE_LABELS[rejectTarget?.record_type] || rejectTarget?.record_type}</span>
                </div>
              </div>

              <label className="flex flex-col gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-700">
                <span>Reason</span>
                <textarea
                  className="h-20 sm:h-28 w-full rounded-lg sm:rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="Explain what needs to be fixed"
                  value={rejectReason}
                  onChange={(event) => {
                    setRejectReason(event.target.value)
                    if (rejectError) setRejectError("")
                  }}
                  maxLength={400}
                />
                <span className="text-[10px] sm:text-xs text-slate-400">{rejectReason.length}/400</span>
              </label>

              {rejectError && (
                <div className="rounded-lg sm:rounded-xl border border-rose-200 bg-rose-50 px-3 sm:px-4 py-2 text-[10px] sm:text-xs text-rose-600">
                  {rejectError}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 sm:gap-3 border-t border-slate-200 bg-slate-50 px-4 sm:px-6 py-3 sm:py-4">
              <button
                type="button"
                className="rounded-lg sm:rounded-xl border border-slate-200 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800"
                onClick={closeRejectModal}
                disabled={Boolean(actioningId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl bg-rose-600 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-rose-200"
                onClick={confirmReject}
                disabled={Boolean(actioningId)}
              >
                {actioningId && <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

const resolveApprover = (submission) => {
  if (!submission) return null
  const metadata = submission.metadata ?? {}
  const candidateNames = [
    submission.approved_by_name,
    submission.approved_by_full_name,
    metadata.approved_by_name,
    metadata.approved_by_full_name,
    submission.reviewed_by_name,
    submission.reviewed_by_full_name,
    metadata.reviewed_by_name,
    metadata.reviewed_by_full_name,
    // new performed_by fields used in db
    submission.performed_by,
    submission.performed_by_name,
    submission.performed_by_full_name,
    metadata.performed_by,
    metadata.performed_by_name,
    metadata.performed_by_full_name,
    submission.actioned_by_name,
    metadata.actioned_by_name,
    submission.approved_by,
    submission.reviewed_by,
    metadata.approved_by,
    metadata.reviewed_by,
  ]

  const resolved = candidateNames.find((v) => typeof v === "string" && v.trim().length)
  if (resolved) return resolved.trim()

  // fallback to numeric ids if present
  const fallbackId = submission.performed_by ?? metadata.performed_by ?? submission.approved_by ?? metadata.approved_by ?? submission.reviewed_by ?? metadata.reviewed_by
  if (fallbackId) return `User #${fallbackId}`

  return null
}