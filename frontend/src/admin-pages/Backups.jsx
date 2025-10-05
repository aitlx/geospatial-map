import { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import {
  Database,
  CloudUpload,
  Clock,
  ShieldAlert,
  DownloadCloud,
  Search,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react"

const BACKUP_WINDOWS = [
  {
    id: "overnight",
    label: "Nightly snapshot",
    description: "Full database snapshot every 02:00, optimized for low-traffic periods.",
  },
  {
    id: "weekly",
    label: "Weekly archive",
    description: "Compression and export to secure cold storage for compliance.",
  },
  {
    id: "ad-hoc",
    label: "Ad-hoc backup",
    description: "On-demand backups for major releases and incident recovery drills.",
  },
]

const PAGE_SIZE = 15

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024
const ALLOWED_EXTENSIONS = [".sql"]
const ALLOWED_EXTENSIONS_LABEL = ALLOWED_EXTENSIONS.map((ext) => ext.replace(".", "").toUpperCase()).join(", ")

const isAllowedExtension = (fileName) => {
  if (!fileName) return false
  const lower = fileName.toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

const timestampFormatter = new Intl.DateTimeFormat("en-PH", {
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

const formatTimestamp = (value) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return timestampFormatter.format(date)
}

const formatBytes = (value) => {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B"
  }

  const units = ["B", "KB", "MB", "GB", "TB"]
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const result = bytes / Math.pow(1024, exponent)
  const decimals = exponent === 0 ? 0 : result >= 10 ? 1 : 2

  return `${result.toFixed(decimals)} ${units[exponent]}`
}

const normalizeBackupRecord = (raw) => {
  if (!raw || typeof raw !== "object") return null

  const id = raw.id ?? raw.backup_id ?? raw.backupId ?? null
  const fileName = raw.fileName ?? raw.filename ?? raw.file_name ?? null
  const originalName =
    raw.originalName ?? raw.original_filename ?? raw.originalFileName ?? raw.originalname ?? null
  const size = raw.size ?? raw.file_size ?? raw.filesize ?? null
  const createdAt = raw.createdAt ?? raw.created_at ?? raw.created ?? null
  const notes = raw.notes ?? raw.note ?? ""
  const createdById = raw.createdBy?.id ?? raw.created_by ?? raw.createdById ?? null
  const createdByName =
    raw.createdBy?.name ?? raw.created_by_name ?? raw.createdByName ?? raw.created_by_fullname ?? null
  const createdByEmail =
    raw.createdBy?.email ?? raw.created_by_email ?? raw.createdByEmail ?? raw.created_by_mail ?? null
  const mimeType = raw.mimeType ?? raw.mime_type ?? null
  const storagePath = raw.storagePath ?? raw.storage_path ?? null
  const downloadUrl = raw.downloadUrl ?? raw.download_url ?? (id ? `/api/backups/${id}/download` : null)

  if (id === null) {
    return {
      id,
      fileName,
      originalName,
      size,
      createdAt,
      notes,
      createdById,
      createdByName,
      createdByEmail,
      mimeType,
      storagePath,
      downloadUrl,
    }
  }

  return {
    id,
    fileName,
    originalName,
    size,
    createdAt,
    notes,
    createdById,
    createdByName,
    createdByEmail,
    mimeType,
    storagePath,
    downloadUrl,
  }
}

const coerceBackupArray = (payload) => {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.results)) return payload.results
    if (Array.isArray(payload.items)) return payload.items
    if (Array.isArray(payload.backups)) return payload.backups
    if (Array.isArray(payload.data)) return payload.data
  }
  return []
}

export default function Backups() {
  const storedUser = useMemo(resolveStoredUser, [])
  const [sessionUser, setSessionUser] = useState(() => storedUser)
  const [accessChecked, setAccessChecked] = useState(false)

  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [banner, setBanner] = useState(null)
  const [unauthorized, setUnauthorized] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [lastRefresh, setLastRefresh] = useState(null)
  const [page, setPage] = useState(1)

  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState(null)

  const [formState, setFormState] = useState({ file: null, notes: "" })
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [actionState, setActionState] = useState({ type: null, id: null })

  const currentRoleId = sessionUser?.roleID ?? sessionUser?.roleid ?? null
  const isSuperAdmin = Number(currentRoleId) === 1
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

  const resetBanner = () => setBanner(null)

  const fetchBackups = useCallback(async () => {
    if (!isSuperAdmin) {
      return
    }

    setLoading(true)
    resetBanner()
    try {
      const response = await axios.get("/api/backups", { withCredentials: true })
      const payload = response?.data?.data ?? []
      const rawRecords = coerceBackupArray(payload)
      const normalized = rawRecords.map(normalizeBackupRecord).filter(Boolean)
      setBackups(normalized)
      setError("")
      setUnauthorized(false)
      setLastRefresh(Date.now())
    } catch (err) {
      const status = err.response?.status
      if (status === 403) {
        setUnauthorized(true)
        setError("Only super administrators can manage the municipal backup archive.")
      } else if (status === 401) {
        setUnauthorized(true)
        setError("Session expired. Please sign in again to manage backups.")
      } else {
        setError(err.response?.data?.message || err.message || "Failed to load backups.")
      }
      setBackups([])
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin])

  useEffect(() => {
    if (!accessChecked || !isSuperAdmin) {
      return
    }

    fetchBackups()
  }, [accessChecked, fetchBackups, isSuperAdmin])

  useEffect(() => {
    if (!banner) return
    const timer = window.setTimeout(() => setBanner(null), 4500)
    return () => window.clearTimeout(timer)
  }, [banner])

  const filteredBackups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) {
      return backups
    }

    return backups.filter((backup) => {
      const haystack = [
        backup.originalName,
        backup.fileName,
        backup.notes,
        backup.createdByName,
        backup.createdByEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [backups, searchTerm])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, backups])

  const filteredCount = filteredBackups.length
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE
  const visibleBackups = useMemo(
    () => filteredBackups.slice(startIndex, endIndex),
    [filteredBackups, startIndex, endIndex],
  )
  const firstVisible = filteredCount === 0 ? 0 : startIndex + 1
  const lastVisible = Math.min(endIndex, filteredCount)
  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < totalPages

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const totalSize = useMemo(() => {
    return backups.reduce((sum, backup) => sum + Number(backup.size || 0), 0)
  }, [backups])

  const latestBackupLabel = useMemo(() => {
    if (!backups.length) {
      return "—"
    }

    const latest = backups.reduce((latestSoFar, backup) => {
      const currentDate = new Date(backup.createdAt ?? 0)
      const latestDate = new Date(latestSoFar.createdAt ?? 0)
      if (Number.isNaN(currentDate.getTime())) {
        return latestSoFar
      }
      if (Number.isNaN(latestDate.getTime()) || currentDate > latestDate) {
        return backup
      }
      return latestSoFar
    }, backups[0])

    return formatTimestamp(latest.createdAt)
  }, [backups])

  const lastRefreshedLabel = useMemo(() => {
    if (!lastRefresh) {
      return ""
    }
    return formatTimestamp(lastRefresh)
  }, [lastRefresh])

  const showEmptyState = !loading && !error && filteredCount === 0
  const emptyMessage = searchTerm
    ? "No backups match your search. Try different keywords or clear the filter."
    : "No backups have been archived yet. Upload the latest snapshot to get started."

  const handleFileChange = (event) => {
    const { files } = event.target
    const file = files?.[0] ?? null
    event.target.value = ""

    if (!file) {
      setFormState((prev) => ({ ...prev, file: null }))
      return
    }

    if (!isAllowedExtension(file.name)) {
  setFormError(`Unsupported file type. Upload SQL database exports only (${ALLOWED_EXTENSIONS_LABEL}).`)
      setFormState((prev) => ({ ...prev, file: null }))
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFormError("File exceeds the 200MB limit. Please upload a smaller archive.")
      setFormState((prev) => ({ ...prev, file: null }))
      return
    }

    setFormError("")
    setFormState((prev) => ({ ...prev, file }))
  }

  const validateUploadForm = () => {
    if (!formState.file) {
      setFormError("Please choose a backup archive to upload.")
      return false
    }

    if (!isAllowedExtension(formState.file.name)) {
  setFormError(`Unsupported file type. Upload SQL database exports only (${ALLOWED_EXTENSIONS_LABEL}).`)
      return false
    }

    if (formState.file.size > MAX_FILE_SIZE_BYTES) {
      setFormError("File exceeds the 200MB limit. Please upload a smaller archive.")
      return false
    }

    setFormError("")
    return true
  }

  const handleUploadSubmit = async (event) => {
    event.preventDefault()
    if (!validateUploadForm()) {
      return
    }

    const formData = new FormData()
    formData.append("backupFile", formState.file)
    const trimmedNotes = formState.notes.trim()
    if (trimmedNotes.length) {
      formData.append("notes", trimmedNotes)
    }

    setSubmitting(true)
    resetBanner()

    try {
      await axios.post("/api/backups", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      })

      setBanner({ type: "success", message: "Backup archived successfully." })
      setUploadModalOpen(false)
      setFormState({ file: null, notes: "" })
      setFormError("")
      await fetchBackups()
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Failed to upload backup."
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownload = async (backup) => {
    if (!backup?.id) return

    setActionState({ type: "download", id: backup.id })
    resetBanner()

    try {
      const downloadEndpoint = backup.downloadUrl ?? `/api/backups/${backup.id}/download`
      const response = await axios.get(downloadEndpoint, {
        responseType: "blob",
        withCredentials: true,
      })

      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = backup.originalName || backup.fileName || `backup-${backup.id}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setBanner({ type: "success", message: "Backup download started." })
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Failed to download backup."
      setBanner({ type: "error", message })
    } finally {
      setActionState({ type: null, id: null })
    }
  }

  const openDeleteModal = (backup) => {
    setSelectedBackup(backup)
    setDeleteModalOpen(true)
  }

  const closeDeleteModal = () => {
    if (actionState.type === "delete") return
    setSelectedBackup(null)
    setDeleteModalOpen(false)
  }

  const confirmDelete = async () => {
    if (!selectedBackup?.id) return

    setActionState({ type: "delete", id: selectedBackup.id })
    resetBanner()

    try {
      await axios.delete(`/api/backups/${selectedBackup.id}`, { withCredentials: true })
      setBanner({ type: "success", message: "Backup deleted permanently." })
      setSelectedBackup(null)
      setDeleteModalOpen(false)
      await fetchBackups()
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Failed to delete backup."
      setBanner({ type: "error", message })
    } finally {
      setActionState({ type: null, id: null })
    }
  }

  const openUploadModal = () => {
    setFormState({ file: null, notes: "" })
    setFormError("")
    setUploadModalOpen(true)
  }

  const closeUploadModal = () => {
    if (submitting) return
    setUploadModalOpen(false)
    setFormState({ file: null, notes: "" })
    setFormError("")
  }

  const handleRefresh = () => {
    resetBanner()
    fetchBackups()
  }

  const handleSearchReset = () => {
    setSearchTerm("")
  }

  const isActionLoading = (type, id) => actionState.type === type && actionState.id === id

  if (!accessChecked) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center p-6 text-slate-600">
        <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          <span className="loading loading-spinner loading-sm text-emerald-400" aria-hidden="true" />
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
              <ShieldAlert className="h-4 w-4 text-emerald-500" />
              Access Restricted
            </div>
            <div className="rounded-2xl border border-amber-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              <p className="font-semibold text-slate-900">Backups &amp; recovery tools are limited to super administrators.</p>
              <p className="mt-2 text-slate-500">
                Coordinate with a super administrator if you need the latest archive or require disaster recovery assistance.
              </p>
            </div>
          </header>
        </div>
      </section>
    )
  }

  const selectedFileName = formState.file?.name ?? ""
  const selectedFileSize = formState.file ? formatBytes(formState.file.size) : ""
  const deleteTargetName = selectedBackup?.originalName || selectedBackup?.fileName || "this backup"
  const deleteTargetSize = selectedBackup ? formatBytes(selectedBackup.size) : "—"

  const messageClasses = banner?.type === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : banner?.type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-600"
      : ""

  const errorClasses = unauthorized
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-rose-200 bg-rose-50 text-rose-600"

  return (
    <section className="px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
            <Database className="h-4 w-4 text-emerald-500" />
            Resilience
          </div>
          <div>
            <h1 className="text-2xl font-semibold uppercase tracking-[0.08em] text-emerald-800">Backups &amp; Recovery</h1>
            <p className="text-sm text-slate-500">
              Guard municipal data with controlled exports, verified storage, and recovery-ready archives. Upload fresh snapshots after major updates and keep compliance teams audit-ready.
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-3 text-slate-600 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openUploadModal}
              className="btn border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
            >
              <CloudUpload size={16} />
              Upload backup
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              className="btn border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
              Refresh
            </button>
          </div>
          {lastRefreshedLabel ? (
            <span className="text-xs uppercase tracking-widest text-slate-400">Last updated {lastRefreshedLabel}</span>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-emerald-600/90">Stored archives</p>
            <p className="text-2xl font-semibold text-slate-900">{backups.length}</p>
            <p className="mt-2 text-xs text-slate-500">Total backups available for disaster recovery.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-emerald-600/90">Storage used</p>
            <p className="text-2xl font-semibold text-slate-900">{formatBytes(totalSize)}</p>
            <p className="mt-2 text-xs text-slate-500">Across municipal archive snapshots.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-emerald-600/90">Latest snapshot</p>
            <p className="text-lg font-semibold text-slate-900">{latestBackupLabel}</p>
            <p className="mt-2 text-xs text-slate-500">Ensure a fresh backup after critical updates.</p>
          </article>
        </div>

  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <form
              onSubmit={(event) => event.preventDefault()}
              className="flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm md:flex-row md:items-center"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by file name, uploader, or notes"
                  className="w-full rounded-xl border border-transparent bg-white py-2 pl-9 pr-3 text-sm text-slate-600 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 self-end md:self-auto">
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={handleSearchReset}
                    className="btn btn-xs border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          {error ? (
            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${errorClasses}`}>
              {error}
            </div>
          ) : null}

          {banner ? (
            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${messageClasses}`}>
              {banner.message}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="loading loading-spinner loading-lg text-emerald-400" aria-hidden="true" />
            </div>
          ) : showEmptyState ? (
            <div className="py-10 text-center text-sm text-slate-500">{emptyMessage}</div>
          ) : (
            <>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {visibleBackups.map((backup, index) => (
                <li
                  key={backup.id ?? `${backup.fileName ?? backup.originalName ?? "backup"}-${index}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <DownloadCloud className="h-4 w-4 text-emerald-500" />
                        <span>{backup.originalName || backup.fileName || "Municipal backup"}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Uploaded {formatTimestamp(backup.createdAt)}
                        {backup.createdByName ? ` • ${backup.createdByName}` : ""}
                        {backup.createdByEmail ? ` (${backup.createdByEmail})` : ""}
                      </p>
                      {backup.notes ? (
                        <p className="text-xs text-slate-500">Notes: {backup.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                        {formatBytes(backup.size)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownload(backup)}
                          className="btn btn-xs border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isActionLoading("download", backup.id) || actionState.type === "delete"}
                        >
                          {isActionLoading("download", backup.id) ? (
                            <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                          ) : (
                            <DownloadCloud size={14} />
                          )}
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteModal(backup)}
                          className="btn btn-xs border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={actionState.type === "delete"}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-700 sm:flex-row">
                <span>
                  {firstVisible === 0
                    ? "Showing 0 backups"
                    : `Showing ${firstVisible}-${lastVisible} of ${filteredCount} backups`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => canGoPrevious && setPage((prev) => Math.max(1, prev - 1))}
                    disabled={!canGoPrevious}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-1.5 font-semibold transition hover:bg-white hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Previous
                  </button>
                  <span className="text-emerald-600/80">Page {currentPage} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => canGoNext && setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={!canGoNext}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-1.5 font-semibold transition hover:bg-white hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {BACKUP_WINDOWS.map((window) => (
            <div key={window.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">{window.label}</p>
              <p className="mt-2 text-xs text-slate-500">{window.description}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <CloudUpload className="h-5 w-5 text-emerald-500" />
                Storage destinations
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Primary backups replicate to secure cloud buckets. Secondary copies stay within LGU infrastructure for offline validation.
              </p>
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <ShieldAlert className="h-5 w-5 text-emerald-500" />
                Integrity checks
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Automated checksum validation and alerting keeps every snapshot trustworthy.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 text-sm text-slate-500 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <Clock className="mr-2 inline h-4 w-4 text-emerald-500" />
              Recovery time objective under 30 minutes
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <DownloadCloud className="mr-2 inline h-4 w-4 text-emerald-500" />
              Bare-metal exports for regulatory submissions
            </div>
          </div>
        </div>
      </div>

      {uploadModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Upload backup</h3>
                <p className="text-sm text-gray-600">
                  Archive the latest municipal database snapshot. Accepted format: {ALLOWED_EXTENSIONS_LABEL} only.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-700"
                onClick={closeUploadModal}
                disabled={submitting}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form className="space-y-5 overflow-y-auto px-6 py-6" onSubmit={handleUploadSubmit}>
              <label className="flex flex-col gap-2 text-sm text-gray-700">
                <span>Archive file</span>
                <input
                  type="file"
                  accept={ALLOWED_EXTENSIONS.join(",")}
                  onChange={handleFileChange}
                  className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-gray-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  required
                />
                {selectedFileName ? (
                  <span className="text-xs text-gray-500">
                    Selected: {selectedFileName}
                    {selectedFileSize ? ` • ${selectedFileSize}` : ""}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">
                    Maximum upload size: {formatBytes(MAX_FILE_SIZE_BYTES)}. Encrypted archives recommended.
                  </span>
                )}
              </label>

              <label className="flex flex-col gap-2 text-sm text-gray-700">
                <span>Notes (optional)</span>
                <textarea
                  rows={3}
                  value={formState.notes}
                  onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Describe the backup contents, release version, or incident context."
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              {formError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
              ) : null}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeUploadModal}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:from-emerald-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={submitting}
                >
                  {submitting ? <span className="loading loading-spinner loading-xs" aria-hidden="true" /> : null}
                  Upload backup
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Delete backup</h3>
              <button
                type="button"
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                onClick={closeDeleteModal}
                disabled={actionState.type === "delete"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5 text-sm text-gray-700">
              <p>
                This will permanently remove <span className="font-semibold">{deleteTargetName}</span>
                {deleteTargetSize ? ` (${deleteTargetSize})` : ""} from the municipal archive.
              </p>
              <p className="text-xs text-rose-500">
                This action cannot be undone. Ensure another copy exists before proceeding.
              </p>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                  disabled={actionState.type === "delete"}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:from-rose-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={actionState.type === "delete"}
                >
                  {isActionLoading("delete", selectedBackup?.id) ? (
                    <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                  ) : null}
                  Delete backup
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
