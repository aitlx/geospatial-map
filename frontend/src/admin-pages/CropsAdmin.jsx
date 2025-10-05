import { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import { AlertCircle, CheckCircle2, Edit2, Loader2, Plus, RefreshCw, Sprout, Trash2 } from "lucide-react"

const CATEGORY_OPTIONS = [
  "Cereals",
  "Vegetables",
  "Fruits",
  "Root crops",
  "Legumes",
  "Herbs & spices",
  "Cash crops",
  "Other",
]

const initialFormState = Object.freeze({
  name: "",
  category: "",
})

const normalizeCrop = (payload) => ({
  id: payload?.crop_id ?? payload?.id ?? null,
  name: payload?.crop_name ?? payload?.name ?? "",
  category: payload?.category ?? payload?.crop_category ?? "",
  createdAt: payload?.created_at ?? payload?.createdAt ?? null,
  updatedAt: payload?.updated_at ?? payload?.updatedAt ?? null,
})

const categoryLabel = (value) => {
  if (!value) return "Uncategorized"
  const trimmed = String(value).trim()
  if (!trimmed.length) return "Uncategorized"
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

const PAGE_SIZE = 15

export default function CropsAdmin() {
  const [crops, setCrops] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState("create")
  const [form, setForm] = useState(initialFormState)
  const [saving, setSaving] = useState(false)
  const [selectedCrop, setSelectedCrop] = useState(null)
  const [banner, setBanner] = useState({ type: "", message: "" })
  const [formError, setFormError] = useState("")
  const [deletingId, setDeletingId] = useState(null)
  const [page, setPage] = useState(1)

  const fetchCrops = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axios.get("/api/crops", { withCredentials: true })
      const payload = response?.data?.data ?? response?.data ?? []
      setCrops(Array.isArray(payload) ? payload.map(normalizeCrop) : [])
      setError("")
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Failed to load crops."
      setError(message)
      setCrops([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCrops()
  }, [fetchCrops])

  useEffect(() => {
    if (!modalOpen) {
      setForm(initialFormState)
      setSelectedCrop(null)
      setSaving(false)
      setFormError("")
    }
  }, [modalOpen])

  const filteredCrops = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return crops
    return crops.filter((crop) => {
      const haystack = [crop.name, crop.category].filter(Boolean).join(" ").toLowerCase()
      return haystack.includes(term)
    })
  }, [crops, searchTerm])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, crops])

  const filteredCount = filteredCrops.length
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE
  const visibleCrops = useMemo(
    () => filteredCrops.slice(startIndex, endIndex),
    [filteredCrops, startIndex, endIndex],
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

  const totalCrops = crops.length
  const categoryBreakdown = useMemo(() => {
    return crops.reduce((acc, crop) => {
      const key = categoryLabel(crop.category)
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
  }, [crops])

  const handleOpenModal = (mode, crop = null) => {
    setModalMode(mode)
    if (crop) {
      setSelectedCrop(crop)
      setForm({
        name: crop.name,
        category: crop.category || "",
      })
    } else {
      setSelectedCrop(null)
      setForm(initialFormState)
    }
    setFormError("")
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    if (saving) return
    setModalOpen(false)
  }

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmitSearch = (event) => {
    event.preventDefault()
    setSearchTerm(searchInput)
  }

  const handleResetSearch = () => {
    setSearchInput("")
    setSearchTerm("")
  }

  const handleSave = async (event) => {
    event.preventDefault()
    const trimmedName = form.name.trim()
    const trimmedCategory = form.category.trim()
    if (!trimmedName.length) {
      setFormError("Crop name is required.")
      return
    }

    setSaving(true)
    try {
      const payload = {
        crop_name: trimmedName,
        category: trimmedCategory.length ? trimmedCategory : null,
      }

      if (modalMode === "edit" && selectedCrop) {
        const response = await axios.put(`/api/crops/${selectedCrop.id}`, payload, { withCredentials: true })
        const updated = normalizeCrop(response?.data?.data ?? response?.data ?? selectedCrop)
        setCrops((prev) => prev.map((crop) => (crop.id === updated.id ? updated : crop)))
        setBanner({ type: "success", message: "Crop updated successfully." })
        setFormError("")
      } else {
        const response = await axios.post("/api/crops", payload, { withCredentials: true })
        const created = normalizeCrop(response?.data?.data ?? response?.data ?? null)
        setCrops((prev) => {
          if (!created.id) {
            return [...prev, { ...created, id: Date.now() }]
          }
          const exists = prev.some((crop) => crop.id === created.id)
          return exists ? prev : [...prev, created]
        })
        setBanner({ type: "success", message: "Crop added successfully." })
        setFormError("")
      }

      setModalOpen(false)
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Unable to save crop."
      setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (crop) => {
    const confirmed = window.confirm(`Delete ${crop.name}? This action cannot be undone.`)
    if (!confirmed) return

    setDeletingId(crop.id)
    try {
      await axios.delete(`/api/crops/${crop.id}`, { withCredentials: true })
      setCrops((prev) => prev.filter((item) => item.id !== crop.id))
      setBanner({ type: "success", message: "Crop deleted." })
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Failed to delete crop."
      setBanner({ type: "error", message })
    } finally {
      setDeletingId(null)
    }
  }

  const handleRefresh = () => {
    fetchCrops()
  }

  return (
    <section className="px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-3xl border border-emerald-200 bg-white/95 px-6 py-5 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-400 text-white shadow-md">
                <Sprout className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold uppercase tracking-[0.08em] text-emerald-800">Crops management</h1>
                <p className="text-sm text-slate-500">Maintain the master list used across recommendations, pricing, and analytics.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              {totalCrops} crops tracked
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <form onSubmit={handleSubmitSearch} className="flex w-full max-w-xl items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-2 shadow-sm">
              <input
                type="search"
                placeholder="Search crops by name or category"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="w-full bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
                aria-label="Search crops"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={handleResetSearch}
                  className="text-xs font-semibold text-emerald-600 transition hover:text-emerald-500"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:from-emerald-400 hover:to-teal-400"
                disabled={loading}
              >
                Search
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => handleOpenModal("create")}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow hover:from-emerald-400 hover:to-teal-400"
              >
                <Plus className="h-4 w-4" /> Add crop
              </button>
            </div>
          </div>
        </header>

        {banner.message ? (
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              banner.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {banner.type === "error" ? (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div className="flex-1">{banner.message}</div>
            <button
              type="button"
              onClick={() => setBanner({ type: "", message: "" })}
              className="text-xs font-semibold text-slate-500 transition hover:text-slate-700"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-3 rounded-3xl border border-rose-200 bg-rose-50/90 px-5 py-4 text-sm text-rose-700 shadow-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">We couldn’t load the crops list.</p>
              <p>{error}</p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              Try again
            </button>
          </div>
        ) : null}

        <div className="grid gap-4 rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-sm backdrop-blur">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(categoryBreakdown).map(([label, count]) => (
              <div key={label} className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700">
                <p className="font-semibold tracking-tight">{label}</p>
                <p className="text-xs text-emerald-600/80">{count} records</p>
              </div>
            ))}
            {!Object.keys(categoryBreakdown).length ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700">
                <p className="font-semibold tracking-tight">No crops yet</p>
                <p className="text-xs text-emerald-600/80">Add crops to build the library.</p>
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-emerald-100">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-emerald-100 text-sm">
                <thead className="bg-emerald-50/80">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Crop name
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Category
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50 bg-white/80">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <tr key={index} className="animate-pulse">
                        <td className="px-4 py-3">
                          <div className="h-3.5 w-32 rounded-full bg-emerald-100" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-3.5 w-24 rounded-full bg-emerald-100" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="ml-auto h-3.5 w-20 rounded-full bg-emerald-100" />
                        </td>
                      </tr>
                    ))
                  ) : filteredCount === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-500">
                        No crops match the current search. Try adjusting your filters or add a new crop.
                      </td>
                    </tr>
                  ) : (
                    visibleCrops.map((crop) => {
                      return (
                        <tr key={crop.id} className="transition hover:bg-emerald-50/60">
                          <td className="px-4 py-3 font-medium text-slate-900">{crop.name}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                              <Sprout className="h-3.5 w-3.5" />
                              {categoryLabel(crop.category)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenModal("edit", crop)}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                              >
                                <Edit2 className="h-4 w-4" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(crop)}
                                disabled={deletingId === crop.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingId === crop.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {filteredCount > 0 ? (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-emerald-100 bg-emerald-50/50 px-4 py-3 text-xs text-emerald-700 sm:flex-row">
                <span>
                  Showing {firstVisible === 0 ? 0 : `${firstVisible}-${lastVisible}`} of {filteredCount} crops
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
                  <span className="text-emerald-500/80">Page {currentPage} of {totalPages}</span>
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
            ) : null}
          </div>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-emerald-200 bg-white px-6 py-6 text-slate-800 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-emerald-800">
                  {modalMode === "edit" ? "Update crop" : "Add crop"}
                </h2>
                <p className="text-sm text-slate-500">
                  Provide the crop name and category. This list feeds the recommendation engine and analytics dashboards.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100"
                disabled={saving}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-5">
              <div>
                <label htmlFor="crop-name" className="block text-sm font-semibold text-slate-700">
                  Crop name
                </label>
                <input
                  id="crop-name"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="e.g. Lowland rice"
                  className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <label htmlFor="crop-category" className="block text-sm font-semibold text-slate-700">
                  Category
                </label>
                <select
                  id="crop-category"
                  name="category"
                  value={form.category}
                  onChange={handleFormChange}
                  className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  disabled={saving}
                >
                  <option value="">Uncategorized</option>
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {formError ? (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  <AlertCircle className="h-4 w-4" /> {formError}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-sm font-semibold text-white shadow transition hover:from-emerald-400 hover:to-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {modalMode === "edit" ? "Save changes" : "Add crop"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}
