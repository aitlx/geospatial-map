import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import axios from "axios"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { AlertCircle, ClipboardList, Loader2, MapPin, RefreshCw, Sprout } from "lucide-react"

const STATUS_CONFIG = [
  { key: "approved", label: "Approved", color: "#059669" },
  { key: "pending", label: "Pending", color: "#f59e0b" },
  { key: "rejected", label: "Rejected", color: "#ef4444" },
]

const safeNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const integerFormatter = new Intl.NumberFormat("en-US")
const decimalFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 })
const formatNumber = (value) => integerFormatter.format(safeNumber(value))
const formatTonnage = (value) => decimalFormatter.format(safeNumber(value))

const DEFAULT_TOP_CROP = {
  name: "—",
  seasonLabel: null,
  season: null,
  year: null,
  totalYield: 0,
  entries: 0,
  scope: null,
}

const INITIAL_SUMMARY = {
  totals: {
    barangaysReported: 0,
    submissions: 0,
    topCrop: DEFAULT_TOP_CROP,
  },
  statusDistribution: STATUS_CONFIG.map(({ key }) => ({ status: key, count: 0 })),
  timeline: [],
  recommendationBreakdown: [],
}

const ensureStatusDistribution = (raw = []) => {
  const base = {
    approved: 0,
    pending: 0,
    rejected: 0,
    other: 0,
  }

  raw.forEach((entry) => {
    const key = typeof entry?.status === "string" ? entry.status.toLowerCase() : ""
    const count = safeNumber(entry?.count)
    if (base[key] !== undefined) {
      base[key] += count
    } else {
      base.other += count
    }
  })

  return STATUS_CONFIG.map(({ key }) => ({ status: key, count: base[key] || 0 }))
}

const ensureTimeline = (raw = []) => {
  const entries = raw
    .map((entry) => {
      const year = safeNumber(entry?.year)
      const month = safeNumber(entry?.month)
      if (!year || !month) return null

      const key = entry?.key || `${year}-${String(month).padStart(2, "0")}`
      const date = new Date(Date.UTC(year, month - 1, 1))
      const label = entry?.label || (Number.isNaN(date.getTime()) ? key : date.toLocaleString("en-US", { month: "short", year: "numeric" }))

      return {
        key,
        label,
        year,
        month,
        total: safeNumber(entry?.total),
        approved: safeNumber(entry?.approved),
        pending: safeNumber(entry?.pending),
        rejected: safeNumber(entry?.rejected),
        other: safeNumber(entry?.other),
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(Date.UTC(a.year, a.month - 1, 1)) - new Date(Date.UTC(b.year, b.month - 1, 1)))

  const startIndex = Math.max(0, entries.length - 12)
  return entries.slice(startIndex)
}

const ensureRecommendations = (raw = []) =>
  raw
    .map((entry) => ({
      crop: entry?.crop || "Unspecified",
      count: safeNumber(entry?.count),
    }))
    .filter((entry) => entry.count > 0)

const normalizeTopCrop = (topCropPayload = null) => {
  if (!topCropPayload || typeof topCropPayload !== "object") {
    return { ...DEFAULT_TOP_CROP }
  }

  const name = typeof topCropPayload.name === "string" && topCropPayload.name.trim().length
    ? topCropPayload.name.trim()
    : "—"

  const year = Number.isFinite(Number(topCropPayload.year)) ? Number(topCropPayload.year) : null
  const scope = typeof topCropPayload.scope === "string" ? topCropPayload.scope : null

  return {
    name,
    seasonLabel: topCropPayload.seasonLabel || null,
    season: topCropPayload.season || null,
    year,
    totalYield: safeNumber(topCropPayload.totalYield),
    entries: safeNumber(topCropPayload.entries),
    scope,
  }
}

const normalizeSummary = (summaryPayload, fallbackPayload = {}) => {
  if (!summaryPayload || typeof summaryPayload !== "object") {
    return {
      ...INITIAL_SUMMARY,
      totals: {
        barangaysReported: safeNumber(fallbackPayload?.barangayCount),
        submissions: safeNumber(fallbackPayload?.totalSubmissions),
        topCrop: { ...DEFAULT_TOP_CROP },
      },
    }
  }

  const totals = summaryPayload?.totals || {}
  const fallbackTotals = fallbackPayload || {}

  return {
    totals: {
      barangaysReported: safeNumber(totals.barangaysReported ?? fallbackTotals.barangayCount),
      submissions: safeNumber(totals.submissions ?? fallbackTotals.totalSubmissions),
      topCrop: normalizeTopCrop(totals.topCrop),
    },
    statusDistribution: ensureStatusDistribution(summaryPayload?.statusDistribution),
    timeline: ensureTimeline(summaryPayload?.timeline),
    recommendationBreakdown: ensureRecommendations(summaryPayload?.recommendationBreakdown),
  }
}

export default function DashboardContent({ onNavigateToMap }) {
  const [summary, setSummary] = useState(INITIAL_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mountedRef = useRef(false)

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data } = await axios.get("/api/dashboard/metrics", { withCredentials: true })
      if (!mountedRef.current) return

      const payload = data?.data || {}
      const normalized = normalizeSummary(payload?.technicianSummary, payload)
      setSummary(normalized)
    } catch (err) {
      if (!mountedRef.current) return
      setSummary(INITIAL_SUMMARY)
      setError(err.response?.data?.message || err.message || "Failed to load dashboard data.")
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    loadStats()
    return () => {
      mountedRef.current = false
    }
  }, [loadStats])

  const statusData = useMemo(() => {
    const total = summary.statusDistribution.reduce((sum, entry) => sum + entry.count, 0)
    return summary.statusDistribution.map((entry) => {
      const config = STATUS_CONFIG.find((item) => item.key === entry.status)
      const label = config?.label || entry.status
      const color = config?.color || "#64748b"
      const percentage = total > 0 ? Math.round((entry.count / total) * 100) : 0
      return {
        ...entry,
        label,
        color,
        value: entry.count,
        percentage,
        total,
      }
    })
  }, [summary.statusDistribution])

  const timelineData = useMemo(
    () =>
      summary.timeline.map((entry) => ({
        ...entry,
        label: entry.label,
      })),
    [summary.timeline],
  )

  const recommendationData = useMemo(() => summary.recommendationBreakdown, [summary.recommendationBreakdown])

  const cards = useMemo(() => {
    const topCrop = summary.totals.topCrop || DEFAULT_TOP_CROP
    const IconMap = MapPin
    const IconSubmissions = ClipboardList
    const IconCrop = Sprout

    const seasonParts = []
    if (topCrop.seasonLabel) seasonParts.push(topCrop.seasonLabel)
    if (topCrop.year) seasonParts.push(topCrop.year)
    const seasonLabel = seasonParts.join(" • ")

    const topCropCaption = (() => {
      if (topCrop.name === "—") {
        return "Submit yield data to surface trends"
      }
      if (topCrop.scope === "global") {
        return seasonLabel ? `Across GeoAgriTech (${seasonLabel})` : "Across all approved barangay yields"
      }
      return seasonLabel || "Based on your recent submissions"
    })()

    const topCropFooter = (() => {
      if (topCrop.name === "—" || topCrop.totalYield <= 0) {
        return null
      }
      const base = `${formatTonnage(topCrop.totalYield)} kg logged`
      const records = `${formatNumber(topCrop.entries)} record${topCrop.entries === 1 ? "" : "s"}`
      return topCrop.scope === "global"
        ? `${base} across GeoAgriTech • ${records}`
        : `${base} • ${records}`
    })()

    return [
      {
        id: "barangays",
        label: "Total barangays reported",
        caption: "Barangays where you've logged data",
        value: formatNumber(summary.totals.barangaysReported),
        icon: IconMap,
        accent: "from-emerald-500 to-teal-500",
        footer: `${formatNumber(summary.totals.submissions)} total entries submitted`,
      },
      {
        id: "submissions",
        label: "Personal inputs submitted",
        caption: "Your yield and price submissions",
        value: formatNumber(summary.totals.submissions),
        icon: IconSubmissions,
        accent: "from-teal-500 to-cyan-500",
        footer: loading ? "Syncing latest data…" : "Updated with approved, pending, and rejected records",
      },
      {
        id: "top-crop",
        label: "Top crop",
        caption: topCropCaption,
        value: topCrop.name,
        icon: IconCrop,
        accent: "from-emerald-400 to-lime-400",
        footer: topCropFooter,
      },
    ]
  }, [summary, loading])

  const statusTotal = statusData.reduce((sum, entry) => sum + entry.value, 0)

  const timelineLineConfig = [
    { key: "total", label: "Total submissions", color: "#0f766e", strokeWidth: 2.5 },
    { key: "approved", label: "Approved", color: "#10b981", strokeWidth: 2 },
    { key: "pending", label: "Pending", color: "#f59e0b", strokeWidth: 1.75 },
    { key: "rejected", label: "Rejected", color: "#ef4444", strokeWidth: 1.75 },
  ]

  return (
    <div className="min-h-screen space-y-6 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white px-4 py-6 text-slate-800 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">Technician workspace</p>
          <h1 className="mt-2 text-2xl font-semibold uppercase tracking-[0.08em] text-emerald-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Monitor submission health and crop performance across your barangays.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateToMap?.()}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-4 py-2 text-sm font-medium text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
          >
            Explore map
          </button>
          <button
            type="button"
            onClick={loadStats}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-4 py-2 text-sm font-medium text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh data
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <article
              key={card.id}
            className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/85 p-5 shadow-md shadow-emerald-900/5 transition hover:shadow-lg"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-10`} />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600">{card.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900 sm:text-[26px]">
                  {loading ? <Loader2 className="h-6 w-6 animate-spin text-emerald-500" /> : card.value}
                </p>
                <p className="mt-2 text-xs text-slate-500">{card.caption}</p>
              </div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                <Icon className="h-5 w-5" />
              </span>
            </div>
              {card.footer ? <p className="mt-4 text-xs text-slate-400">{card.footer}</p> : null}
            </article>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-emerald-100/60 bg-white/90 p-6 shadow-md shadow-emerald-900/5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Submission status</h2>
              <p className="text-sm text-slate-500">Distribution of approved, pending, and rejected submissions.</p>
            </div>
            {statusTotal > 0 ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                {formatNumber(statusTotal)} total
              </span>
            ) : null}
          </div>

          {statusTotal === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 text-center text-sm text-emerald-600">
              <AlertCircle className="mb-2 h-5 w-5" />
              <p>No submissions yet. Submit data to populate status insights.</p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {statusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${formatNumber(value)} submissions`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-3">
                {statusData.map((entry) => (
                  <li key={entry.status} className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-sm font-semibold text-slate-700">{entry.label}</span>
                    </div>
                    <div className="text-right text-sm text-slate-600">
                      <p className="font-semibold text-slate-800">{formatNumber(entry.value)}</p>
                      <p className="text-xs text-slate-500">{entry.percentage}% of submissions</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-emerald-100/60 bg-white/90 p-6 shadow-md shadow-emerald-900/5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Submissions over time</h2>
              <p className="text-sm text-slate-500">Monthly totals with approval trajectory.</p>
            </div>
            {timelineData.length ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">Last {timelineData.length} month{timelineData.length === 1 ? "" : "s"}</span>
            ) : null}
          </div>

          {timelineData.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 text-center text-sm text-emerald-600">
              <AlertCircle className="mb-2 h-5 w-5" />
              <p>We’ll chart your activity once you submit yield or price data.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#94a3b8" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} />
                <YAxis allowDecimals={false} stroke="#94a3b8" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} minTickGap={8} />
                <Tooltip formatter={(value, name) => [`${formatNumber(value)} submissions`, name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {timelineLineConfig.map((line) => {
                  const hasData = line.key === "total" || timelineData.some((entry) => entry[line.key] > 0)
                  if (!hasData) return null
                  return (
                    <Line
                      key={line.key}
                      type="monotone"
                      dataKey={line.key}
                      name={line.label}
                      stroke={line.color}
                      strokeWidth={line.strokeWidth}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-emerald-100/60 bg-white/90 p-6 shadow-md shadow-emerald-900/5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Crops recommended breakdown</h2>
            <p className="text-sm text-slate-500">Aggregated crop recommendations for your covered barangays.</p>
          </div>
          {recommendationData.length ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
              {formatNumber(recommendationData.reduce((sum, entry) => sum + entry.count, 0))} recommendations
            </span>
          ) : null}
        </div>

        {recommendationData.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 text-center text-sm text-emerald-600">
            <AlertCircle className="mb-2 h-5 w-5" />
            <p>No recommendation insights yet. Generate or sync recommendations to populate this chart.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={recommendationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="crop" stroke="#94a3b8" tick={{ fill: "#64748b", fontSize: 12 }} angle={-12} textAnchor="end" interval={0} height={70} />
              <YAxis allowDecimals={false} stroke="#94a3b8" tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip formatter={(value, name) => [`${formatNumber(value)} recommendation${value === 1 ? "" : "s"}`, name]} />
              <Bar dataKey="count" radius={[10, 10, 0, 0]} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  )
}