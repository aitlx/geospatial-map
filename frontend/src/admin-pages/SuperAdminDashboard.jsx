import { useMemo } from "react"
import {
  Activity,
  AlertCircle,
  BarChart3,
  Clock,
  Database,
  Grid3x3,
  Loader2,
  RefreshCw,
  Sprout,
  Users,
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
} from "recharts"
import { useDashboardMetrics } from "../hooks/useDashboardMetrics"

const CARD_DEFINITIONS = [
  {
    id: "total-users",
    key: "totalUsers",
    label: "Total users",
    caption: "Accounts across every role",
    icon: Users,
    gradient: "from-emerald-400/70 to-teal-500/40",
    formatter: "integer",
  },
  {
    id: "total-entries",
    key: "totalEntries",
    label: "Data entries",
    caption: "Approved and pending barangay records",
    icon: Database,
    gradient: "from-sky-400/70 to-cyan-500/35",
    formatter: "integer",
  },
  {
    id: "submission-rate",
    key: "submissionRate",
    label: "Submission rate",
    caption: "Barangays submitting in the last 30 days",
    icon: Activity,
    gradient: "from-amber-400/70 to-orange-500/35",
    formatter: "percentage",
  },
]

const STATUS_PRIORITY = ["approved", "pending", "rejected"]

const INTEGER_FORMAT = new Intl.NumberFormat("en-US")
const DECIMAL_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 })

const formatInteger = (value) => INTEGER_FORMAT.format(Math.max(Math.round(Number(value) || 0), 0))
const formatPercentage = (value) => `${DECIMAL_FORMAT.format(Math.max(Math.min(Number(value) || 0, 100), 0))}%`
const formatTonnage = (value) => `${DECIMAL_FORMAT.format(Math.max(Number(value) || 0, 0))} t`

const getStatusColor = (status) => {
  switch (status) {
    case "approved":
      return [16, 185, 129]
    case "pending":
      return [245, 158, 11]
    case "rejected":
      return [239, 68, 68]
    default:
      return [99, 102, 241]
  }
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getHeatmapCellStyle = (status, count, maxCount) => {
  const [r, g, b] = getStatusColor(status)

  if (!count) {
    return {
      background: "rgba(148, 163, 184, 0.12)",
      color: "#475569",
      borderColor: "transparent",
    }
  }

  const ratio = maxCount > 0 ? clamp(count / maxCount, 0, 1) : 0
  const alpha = 0.2 + 0.6 * ratio
  const textColor = ratio > 0.55 ? "#f8fafc" : "#0f172a"

  return {
    background: `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`,
    color: textColor,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.35)`,
  }
}

const renderEmptyState = (message, icon) => (
  <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-6 py-10 text-center text-sm text-emerald-700">
    <div className="mb-3 rounded-full bg-white p-2 text-emerald-500 shadow-inner shadow-emerald-200/60">{icon}</div>
    <p className="max-w-xs leading-relaxed">{message}</p>
  </div>
)

export default function SuperAdminDashboard() {
  const { data, loading, error, refresh } = useDashboardMetrics()

  const insights = data?.insights ?? {}
  const heatmap = insights.submissionHeatmap ?? { statuses: [], barangays: [], maxCellCount: 0 }
  const harvestComparison = insights.harvestComparison ?? { seasons: [] }
  const topBarangays = insights.topBarangays ?? { season: {}, barangays: [], totalYield: 0, maxYield: 0 }

  const formattedLastUpdated = useMemo(() => {
    if (!data?.lastUpdated) return null
    const parsed = new Date(data.lastUpdated)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
  }, [data?.lastUpdated])

  const cardItems = useMemo(
    () => {
      const safeCards = data?.insights?.cards ?? {}
      return CARD_DEFINITIONS.map(({ id, key, label, caption, icon: IconComponent, gradient, formatter }) => {
        const rawValue = safeCards[key]
        const value = formatter === "percentage" ? formatPercentage(rawValue) : formatInteger(rawValue)
        return {
          id,
          label,
          caption,
          gradient,
          IconComponent,
          value,
        }
      })
    },
    [data?.insights?.cards],
  )

  const heroHighlights = useMemo(
    () => [
      ...cardItems,
      {
        id: "barangay-coverage",
        label: "Barangays covered",
        caption: "with one or more submissions",
        IconComponent: Grid3x3,
        value: formatInteger(data?.barangayCount),
      },
    ],
    [cardItems, data?.barangayCount],
  )

  const heatmapStatuses = useMemo(() => {
    const unique = Array.from(
      new Set((heatmap.statuses ?? []).map((status) => (status ? String(status).toLowerCase().trim() : "other"))),
    )

    const prioritized = STATUS_PRIORITY.filter((status) => unique.includes(status))
    const extras = unique.filter((status) => !STATUS_PRIORITY.includes(status)).sort()
    return prioritized.concat(extras)
  }, [heatmap.statuses])

  const heatmapRows = useMemo(() => (heatmap.barangays ?? []).slice(0, 10), [heatmap.barangays])
  const maxHeatmapCell = Math.max(Number(heatmap.maxCellCount) || 0, 1)

  const heatmapGridColumns = useMemo(
    () => ({
      gridTemplateColumns: `minmax(180px, 1.1fr) repeat(${Math.max(heatmapStatuses.length, 1)}, minmax(82px, 1fr))`,
    }),
    [heatmapStatuses.length],
  )

  const harvestChartData = useMemo(
    () =>
      (harvestComparison.seasons ?? []).slice(0, 6).map((season) => ({
        season: season?.label ?? "Unspecified",
        approved: Number(season?.approved) || 0,
        pending: Number(season?.pending) || 0,
        rejected: Number(season?.rejected) || 0,
        other: Number(season?.other) || 0,
      })),
    [harvestComparison.seasons],
  )

  const harvestHasData = harvestChartData.some((season) => season.approved || season.pending || season.rejected || season.other)

  const barangaySeasonLabel = useMemo(() => {
    const season = topBarangays.season ?? {}
    if (!season.label && !season.year) return "All records"
    if (season.label && season.year) return `${season.label} • ${season.year}`
    return season.label || (season.year ? `Season ${season.year}` : "All records")
  }, [topBarangays.season])

  const totalBarangayYield = formatTonnage(topBarangays.totalYield ?? 0)

  return (
    <section className="space-y-6 bg-gradient-to-br from-emerald-50 via-teal-50/80 to-white px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-[32px] border border-emerald-200/65 bg-gradient-to-br from-emerald-500 via-emerald-400 to-teal-500 text-emerald-50 shadow-[0_40px_90px_-60px_rgba(6,95,70,0.72)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.32),_transparent_65%)]" />
        <div className="absolute -right-28 top-4 h-48 w-48 rounded-full bg-white/12 blur-3xl" />
        <div className="absolute -left-16 bottom-6 h-48 w-48 rounded-full bg-emerald-900/20 blur-3xl" />
        <div className="relative z-0 flex flex-col gap-8 px-6 py-8 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/90">
                Superadmin workspace
              </span>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">System-wide oversight and analytics</h1>
                <p className="text-sm text-emerald-50/85 sm:text-base">
                  Monitor barangay performance, submissions, and adoption across your LGU.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4 lg:flex-col lg:items-end">
              {formattedLastUpdated ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium text-emerald-50/90">
                  <Clock className="h-4 w-4" /> Updated {formattedLastUpdated}
                </div>
              ) : null}
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-white/95 px-5 py-2 text-sm font-semibold text-emerald-700 shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:translate-y-0 disabled:opacity-80"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh data
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {heroHighlights.map(({ id, label, caption, IconComponent, value }) => {
              const Icon = IconComponent
              return (
                <div
                  key={id}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-white/12 bg-white/12 px-4 py-4 text-left shadow-inner shadow-emerald-900/10 backdrop-blur-sm"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-50/80">{caption}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                    <p className="text-xs text-emerald-100/80">{label}</p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-700 shadow-sm shadow-rose-200/60">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      <article className="space-y-4 rounded-2xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-emerald-900">Submission coverage heatmap</h2>
            <p className="text-sm text-emerald-600">Breakdown of statuses by barangay</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/70 px-3 py-1 text-xs font-medium text-emerald-700">
            <Grid3x3 className="h-4 w-4" /> {heatmapRows.length} barangays
          </div>
        </header>

        {heatmapRows.length ? (
          <div className="overflow-x-auto">
            <div className="min-w-[680px] space-y-3">
              <div className="grid items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500" style={heatmapGridColumns}>
                <span className="px-3">Barangay</span>
                {heatmapStatuses.map((status) => (
                  <span key={status} className="px-3 text-center">
                    {status === "approved"
                      ? "Approved"
                      : status === "pending"
                      ? "Pending"
                      : status === "rejected"
                      ? "Rejected"
                      : status.replace(/\b\w/g, (char) => char.toUpperCase())}
                  </span>
                ))}
              </div>
              <div className="space-y-2">
                {heatmapRows.map((row) => (
                  <div
                    key={row.barangayId}
                    className="grid items-center gap-2 rounded-xl border border-emerald-100/60 bg-emerald-50/40 px-3 py-2 text-sm text-emerald-700 shadow-inner"
                    style={heatmapGridColumns}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-emerald-900">{row.barangayName}</span>
                      <span className="text-xs text-emerald-500">{formatInteger(row.total)} total entries</span>
                    </div>
                    {heatmapStatuses.map((status) => {
                      const count = row.counts?.[status] || 0
                      const style = getHeatmapCellStyle(status, count, maxHeatmapCell)
                      return (
                        <div
                          key={`${row.barangayId}-${status}`}
                          className="flex items-center justify-center rounded-lg border px-2 py-1 text-xs font-semibold transition"
                          style={style}
                        >
                          {formatInteger(count)}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          renderEmptyState(
            "Heatmap data will display after barangay submissions are logged.",
            <Grid3x3 className="h-5 w-5" />,
          )
        )}
      </article>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="space-y-4 rounded-2xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-emerald-900">Seasonal harvest comparison</h2>
              <p className="text-sm text-emerald-600">Approved vs pending tonnage per season</p>
            </div>
          </header>

          {harvestHasData ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={harvestChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(16, 185, 129, 0.18)" />
                <XAxis dataKey="season" stroke="#059669" tickLine={false} fontSize={12} angle={-8} dy={12} />
                <YAxis stroke="#059669" tickLine={false} fontSize={12} />
                <Tooltip
                  cursor={{ fill: "rgba(16, 185, 129, 0.08)" }}
                  contentStyle={{ borderRadius: 12, borderColor: "rgba(16, 185, 129, 0.2)" }}
                  formatter={(value, name) => {
                    const label =
                      name === "approved"
                        ? "Approved"
                        : name === "pending"
                        ? "Pending"
                        : name === "rejected"
                        ? "Rejected"
                        : "Other"
                    return [formatTonnage(value), label]
                  }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Bar dataKey="approved" stackId="season" fill="#047857" radius={[8, 8, 0, 0]} />
                <Bar dataKey="pending" stackId="season" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                <Bar dataKey="rejected" stackId="season" fill="#ef4444" radius={[8, 8, 0, 0]} />
                <Bar dataKey="other" stackId="season" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            renderEmptyState(
              "Seasonal harvest totals will populate after yields are logged by technicians.",
              <BarChart3 className="h-5 w-5" />,
            )
          )}
        </article>

        <article className="space-y-5 rounded-2xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-emerald-900">Top barangays</h2>
              <p className="text-sm text-emerald-600">{barangaySeasonLabel}</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100/70 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Sprout className="h-4 w-4" /> {totalBarangayYield} harvested
            </span>
          </header>

          {topBarangays.barangays?.length ? (
            <ul className="space-y-3">
              {topBarangays.barangays.slice(0, 6).map((barangay) => (
                <li
                  key={barangay.barangayId}
                  className="flex items-center justify-between gap-4 rounded-xl border border-emerald-100/70 bg-emerald-50/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">{barangay.barangayName}</p>
                    <p className="text-xs text-emerald-500">
                      {formatInteger(barangay.submissionCount)} submissions
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-700 shadow-inner shadow-emerald-100/60">
                    {formatTonnage(barangay.totalYield)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            renderEmptyState(
              "Barangay performance will appear once yield submissions are approved.",
              <Sprout className="h-5 w-5" />,
            )
          )}
        </article>
      </div>
    </section>
  )
}
