import { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import {
  BarChart2,
  TrendingUp,
  Percent,
  FileDown,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  Sprout,
} from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts"

const NUMBER_FORMAT = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 })
const NUMBER_FORMAT_WITH_DECIMALS = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 })
const CURRENCY_FORMAT = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
})

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 6 }).map((_, index) => String(currentYear - index))
const SEASON_OPTIONS = [
  { value: "all", label: "All seasons" },
  { value: "dry", label: "Dry" },
  { value: "wet", label: "Wet" },
  { value: "summer", label: "Summer" },
  { value: "rainy", label: "Rainy" },
  { value: "harvest", label: "Harvest" },
  { value: "peak", label: "Peak" },
  { value: "lean", label: "Lean" },
]

const LIMIT_OPTIONS = [5, 8, 10]

const safeNumber = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeTopCrop = (candidate) => {
  if (!candidate || typeof candidate !== "object") return null
  const cropId = candidate.crop_id ?? candidate.cropId ?? null
  const cropName = candidate.crop_name ?? candidate.cropName ?? "Unnamed crop"
  const totalYield = safeNumber(candidate.total_yield ?? candidate.totalYield)
  const averagePrice = safeNumber(candidate.average_price ?? candidate.averagePrice)
  const averageScore = safeNumber(candidate.average_score ?? candidate.averageScore)

  return {
    cropId,
    cropName,
    totalYield,
    averagePrice,
    averageScore,
  }
}

const normalizeRecommendation = (candidate) => {
  if (!candidate || typeof candidate !== "object") return null
  const cropId = candidate.crop_id ?? candidate.cropId ?? null
  const cropName = candidate.crop_name ?? candidate.cropName ?? "Unnamed crop"
  const averageYield = safeNumber(candidate.avg_yield ?? candidate.average_yield ?? candidate.averageYield)
  const averagePrice = safeNumber(candidate.avg_price ?? candidate.average_price ?? candidate.averagePrice)
  const score = safeNumber(candidate.score)
  const recommendationCount = safeNumber(candidate.recommendation_count ?? candidate.count ?? candidate.total)
  const firstYear = candidate.first_year ?? candidate.firstYear ?? null
  const latestYear = candidate.latest_year ?? candidate.latestYear ?? null

  return {
    cropId,
    cropName,
    averageYield,
    averagePrice,
    score,
    recommendationCount,
    firstYear,
    latestYear,
  }
}

const buildSeasonLabel = (season) => {
  if (!season || season === "all") return "All seasons"
  return season
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

const formatNumber = (value) => NUMBER_FORMAT.format(safeNumber(value))
const formatNumberWithDecimals = (value) => NUMBER_FORMAT_WITH_DECIMALS.format(safeNumber(value))
const formatCurrency = (value) => CURRENCY_FORMAT.format(Math.max(0, safeNumber(value)))

const toCsvValue = (value) => {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") {
    if (value.includes(",") || value.includes("\"")) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }
  return String(value)
}

const buildCsv = (rows) => {
  const header = [
    "Crop",
    "Total Yield",
    "Average Yield",
    "Average Price",
    "Average Score",
    "Recommendations",
    "First Year",
    "Latest Year",
  ]

  const lines = rows.map((row) =>
    [
      toCsvValue(row.cropName),
      toCsvValue(row.totalYield ?? ""),
      toCsvValue(row.averageYield ?? ""),
      toCsvValue(row.averagePrice ?? ""),
      toCsvValue(row.averageScore ?? row.score ?? ""),
      toCsvValue(row.recommendationCount ?? ""),
      toCsvValue(row.firstYear ?? ""),
      toCsvValue(row.latestYear ?? ""),
    ].join(","),
  )

  return [header.join(","), ...lines].join("\n")
}

export default function ReportsAnalytics() {
  const [filters, setFilters] = useState({
    season: "all",
    year: YEAR_OPTIONS[0],
    limit: LIMIT_OPTIONS[1],
  })
  const [topCrops, setTopCrops] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [lastUpdated, setLastUpdated] = useState(null)
  const placeholderActive = true

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError("")

    const topCropParams = { limit: filters.limit }
    const recommendationsParams = { limit: filters.limit, groupBy: "crop" }

    if (filters.year && filters.year !== "all") {
      topCropParams.year = filters.year
      recommendationsParams.year = filters.year
    }

    if (filters.season && filters.season !== "all") {
      topCropParams.season = filters.season
      recommendationsParams.season = filters.season
    }

    try {
      const [topCropResponse, recommendationResponse] = await Promise.all([
        axios.get("/api/top-crops", { params: topCropParams, withCredentials: true }),
        axios.get("/api/recommendations", { params: recommendationsParams, withCredentials: true }),
      ])

      const topRowsCandidate =
        topCropResponse?.data?.data?.results ??
        topCropResponse?.data?.data ??
        topCropResponse?.data?.results ??
        []

      const recommendationRowsCandidate =
        recommendationResponse?.data?.data?.results ??
        recommendationResponse?.data?.data ??
        recommendationResponse?.data?.results ??
        []

      const normalizedTopCrops = Array.isArray(topRowsCandidate)
        ? topRowsCandidate.map(normalizeTopCrop).filter(Boolean)
        : []

      const normalizedRecommendations = Array.isArray(recommendationRowsCandidate)
        ? recommendationRowsCandidate.map(normalizeRecommendation).filter(Boolean)
        : []

      setTopCrops(normalizedTopCrops)
      setRecommendations(normalizedRecommendations)
      setLastUpdated(new Date())
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Failed to load analytics data."
      setError(message)
      setTopCrops([])
      setRecommendations([])
    } finally {
      setLoading(false)
    }
  }, [filters.limit, filters.season, filters.year])

  useEffect(() => {
    if (placeholderActive) return
    fetchAnalytics()
  }, [fetchAnalytics, placeholderActive])


  const totalYield = useMemo(
    () => topCrops.reduce((sum, crop) => sum + safeNumber(crop.totalYield), 0),
    [topCrops],
  )

  const averageScore = useMemo(() => {
    if (!recommendations.length) return 0
    const total = recommendations.reduce((sum, entry) => sum + safeNumber(entry.score), 0)
    return total / recommendations.length
  }, [recommendations])

  const averagePrice = useMemo(() => {
    if (!topCrops.length) return 0
    const total = topCrops.reduce((sum, entry) => sum + safeNumber(entry.averagePrice), 0)
    return total / topCrops.length
  }, [topCrops])

  const topPerformer = useMemo(() => {
    if (!recommendations.length) return null
    return [...recommendations].sort((a, b) => safeNumber(b.score) - safeNumber(a.score))[0]
  }, [recommendations])

  const chartData = useMemo(
    () =>
      topCrops.map((crop) => ({
        name: crop.cropName,
        yield: safeNumber(crop.totalYield),
        score: safeNumber(crop.averageScore),
      })),
    [topCrops],
  )

  const trendData = useMemo(() => {
    if (!recommendations.length) return []
    return recommendations.map((entry) => ({
      name: entry.cropName,
      score: safeNumber(entry.score),
      yield: safeNumber(entry.averageYield),
    }))
  }, [recommendations])

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return "—"
    return lastUpdated.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
  }, [lastUpdated])

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: key === "limit" ? Number(value) : value,
    }))
  }

  const handleExportCsv = () => {
    if (typeof window === "undefined" || (!topCrops.length && !recommendations.length)) return

    const dataset = topCrops.map((crop) => {
      const recommendation = recommendations.find((entry) => entry.cropId === crop.cropId)
      return {
        cropName: crop.cropName,
        totalYield: formatNumberWithDecimals(crop.totalYield),
        averageYield: recommendation ? formatNumberWithDecimals(recommendation.averageYield) : "",
        averagePrice: formatCurrency(crop.averagePrice).replace(/[^0-9.,-]/g, ""),
        averageScore: recommendation
          ? formatNumberWithDecimals(recommendation.score)
          : formatNumberWithDecimals(crop.averageScore),
        recommendationCount: recommendation?.recommendationCount ?? "",
        firstYear: recommendation?.firstYear ?? "",
        latestYear: recommendation?.latestYear ?? "",
      }
    })

    const csvContent = buildCsv(dataset)

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    const seasonSlug = filters.season === "all" ? "all" : filters.season
    const yearSlug = filters.year === "all" ? "all" : filters.year
    link.download = `geoagritech-analytics-${yearSlug}-${seasonSlug}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const emptyState = !loading && !topCrops.length && !recommendations.length

  if (placeholderActive) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 py-10 text-center text-slate-700 sm:px-6 lg:px-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm">
          <BarChart2 className="h-8 w-8" />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-[0.08em] text-emerald-800">Reports &amp; Analytics</h1>
          <p className="mx-auto max-w-xl text-sm text-slate-500">
            We're still polishing the analytics workspace so it can surface actionable insights you can trust. In the meantime,
            you can continue managing submissions and approvals—the data powering this dashboard is being prepared behind the scenes.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6 px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600">
            <BarChart2 className="h-4 w-4" />
            Analytics
          </div>
          <h1 className="mt-3 text-2xl font-semibold uppercase tracking-[0.08em] text-emerald-800">
            Reports &amp; Analytics
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Explore performance insights across recommendations, yields, and pricing to drive barangay interventions.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-xs text-slate-500">
          <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2">
            <dt className="uppercase tracking-[0.25em] text-emerald-600">Season</dt>
            <dd className="mt-1 font-semibold text-slate-900">{buildSeasonLabel(filters.season)}</dd>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2">
            <dt className="uppercase tracking-[0.25em] text-emerald-600">Year</dt>
            <dd className="mt-1 font-semibold text-slate-900">{filters.year === "all" ? "All years" : filters.year}</dd>
          </div>
        </dl>
      </header>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="rounded-3xl border border-emerald-100/70 bg-white/85 p-6 shadow-sm shadow-emerald-900/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
              <Filter className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Season</span>
              <select
                className="ml-3 text-sm font-medium text-slate-700 focus:outline-none"
                value={filters.season}
                onChange={(event) => handleFilterChange("season", event.target.value)}
                disabled={loading}
              >
                {SEASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
              <Filter className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Year</span>
              <select
                className="ml-3 text-sm font-medium text-slate-700 focus:outline-none"
                value={filters.year}
                onChange={(event) => handleFilterChange("year", event.target.value)}
                disabled={loading}
              >
                <option value="all">All years</option>
                {YEAR_OPTIONS.map((yearOption) => (
                  <option key={yearOption} value={yearOption}>
                    {yearOption}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
              <Filter className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Limit</span>
              <select
                className="ml-3 text-sm font-medium text-slate-700 focus:outline-none"
                value={filters.limit}
                onChange={(event) => handleFilterChange("limit", event.target.value)}
                disabled={loading}
              >
                {LIMIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    Top {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={fetchAnalytics}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/20"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? "Refreshing" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || (topCrops.length === 0 && recommendations.length === 0)}
            >
              <FileDown className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-emerald-100 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-500">Total yield</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{formatNumber(totalYield)} MT</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Sprout className="h-6 w-6" />
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-100 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-500">Avg score</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{formatNumberWithDecimals(averageScore)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Percent className="h-6 w-6" />
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-100 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-500">Avg market price</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{formatCurrency(averagePrice)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-100 bg-white/90 p-5 text-sm text-slate-600 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-500">Last refreshed</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{lastUpdatedLabel}</p>
            <p className="mt-1 text-xs text-slate-500">
              Fetches top crops and aggregated recommendation scores to guide planning.
            </p>
          </article>
        </div>
      </div>

      {emptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/60 px-8 py-12 text-center text-sm text-emerald-700">
          <BarChart2 className="h-8 w-8" />
          <p>No analytics data is available yet for the selected filters. Try a different season or year.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
            <article className="rounded-3xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Yield contribution by crop</h2>
                  <p className="text-xs text-slate-500">Ranking is based on total yield captured in AI recommendations.</p>
                </div>
              </div>
              <div className="mt-6 h-[320px]">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-emerald-500">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : chartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fill: "#334155", fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: "rgba(16, 185, 129, 0.08)" }}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid rgba(16, 185, 129, 0.18)",
                          boxShadow: "0 12px 32px -12px rgba(16, 185, 129, 0.35)",
                        }}
                        formatter={(value, name) => [formatNumberWithDecimals(value), name === "yield" ? "Total yield" : "Average score"]}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => (value === "yield" ? "Total yield" : "Average score")} />
                      <Bar dataKey="yield" fill="#0f766e" radius={[10, 10, 0, 0]} name="yield" />
                      <Bar dataKey="score" fill="#14b8a6" radius={[10, 10, 0, 0]} name="score" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-6 text-center text-sm text-emerald-700">
                    Datasets are still aggregating. Capture more barangay recommendations to populate this chart.
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Performance spotlight</h2>
                <p className="text-xs text-slate-500">Identifies the highest scoring crop across the selected filters.</p>
              </div>
              <div className="mt-6 space-y-4">
                {loading ? (
                  <div className="flex h-32 items-center justify-center text-emerald-500">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : topPerformer ? (
                  <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-semibold text-emerald-800">{topPerformer.cropName}</p>
                      <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-600">
                        Score {formatNumberWithDecimals(topPerformer.score)}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-xs text-emerald-700">
                      <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                        <dt className="uppercase tracking-[0.2em] text-emerald-500">Avg yield</dt>
                        <dd className="mt-1 text-base font-semibold text-emerald-800">
                          {formatNumberWithDecimals(topPerformer.averageYield)} MT
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                        <dt className="uppercase tracking-[0.2em] text-emerald-500">Avg price</dt>
                        <dd className="mt-1 text-base font-semibold text-emerald-800">
                          {formatCurrency(topPerformer.averagePrice)}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                        <dt className="uppercase tracking-[0.2em] text-emerald-500">Recommendations</dt>
                        <dd className="mt-1 text-base font-semibold text-emerald-800">
                          {formatNumber(topPerformer.recommendationCount)}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                        <dt className="uppercase tracking-[0.2em] text-emerald-500">Coverage</dt>
                        <dd className="mt-1 text-base font-semibold text-emerald-800">
                          {topPerformer.firstYear ?? "—"} – {topPerformer.latestYear ?? "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-6 text-sm text-emerald-700">
                    No crop has accumulated enough recommendations to build a spotlight yet. Try widening the filters.
                  </div>
                )}
              </div>
            </article>
          </div>

          <article className="rounded-3xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Top performing crops</h2>
                <p className="text-xs text-slate-500">Blends recommendation scores with total recorded yield to inform program focus.</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-600">
                Showing top {filters.limit}
              </span>
            </div>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-emerald-100">
              <table className="min-w-full text-sm">
                <thead className="bg-emerald-50/70 text-xs uppercase tracking-[0.2em] text-emerald-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Crop</th>
                    <th className="px-4 py-3 text-right font-semibold">Total yield (MT)</th>
                    <th className="px-4 py-3 text-right font-semibold">Avg score</th>
                    <th className="px-4 py-3 text-right font-semibold">Avg price</th>
                    <th className="px-4 py-3 text-right font-semibold">Recommendations</th>
                  </tr>
                </thead>
                <tbody>
                  {topCrops.map((crop) => {
                    const recommendation = recommendations.find((entry) => entry.cropId === crop.cropId)
                    return (
                      <tr key={crop.cropId ?? crop.cropName} className="border-b border-emerald-100/60 last:border-b-0">
                        <td className="px-4 py-3 font-semibold text-slate-900">{crop.cropName}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatNumberWithDecimals(crop.totalYield)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatNumberWithDecimals(recommendation ? recommendation.score : crop.averageScore)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(crop.averagePrice)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {recommendation ? formatNumber(recommendation.recommendationCount) : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </article>

          {trendData.length ? (
            <article className="rounded-3xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Score vs. yield trend</h2>
                  <p className="text-xs text-slate-500">Helps spot crops that balance strong scores with reliable yields.</p>
                </div>
              </div>
              <div className="mt-6 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fill: "#334155", fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: "#475569", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid rgba(14, 165, 233, 0.18)",
                        boxShadow: "0 12px 32px -12px rgba(14, 165, 233, 0.35)",
                      }}
                      formatter={(value, name) =>
                        [
                          formatNumberWithDecimals(value),
                          name === "score" ? "Average score" : "Average yield",
                        ]
                      }
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    <Line type="monotone" yAxisId="left" dataKey="score" stroke="#0f766e" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" yAxisId="right" dataKey="yield" stroke="#22d3ee" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          ) : null}
        </>
      )}
    </section>
  )
}
