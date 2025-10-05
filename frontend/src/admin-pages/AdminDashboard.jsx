import { useMemo } from "react"
import {
  Activity,
  AlertCircle,
  BarChart3,
  ClipboardCheck,
  Clock,
  Loader2,
  RefreshCw,
  Sprout,
  UserCheck,
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
} from "recharts"
import { useDashboardMetrics } from "../hooks/useDashboardMetrics"

const INTEGER_FORMAT = new Intl.NumberFormat("en-US")
const DECIMAL_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 })

const formatInteger = (value) => INTEGER_FORMAT.format(Math.max(Math.round(Number(value) || 0), 0))
const formatPercentage = (value) => `${DECIMAL_FORMAT.format(Math.max(Math.min(Number(value) || 0, 100), 0))}%`
const formatTonnage = (value) => `${DECIMAL_FORMAT.format(Math.max(Number(value) || 0, 0))} t`

export default function AdminDashboard() {
  const { data, loading, error, refresh } = useDashboardMetrics()

  const pendingApprovals = Number(data?.pendingApprovals) || 0
  const pendingSubmissions = Number(data?.pendingSubmissions) || 0
  const technicianCount = Number(data?.technicianCount) || 0
  const barangayCount = Number(data?.barangayCount) || 0
  const submissionRate = Number(data?.insights?.cards?.submissionRate) || 0

  const yieldSummary = data?.yieldSummary ?? { total: 0, pending: 0 }
  const priceSummary = data?.priceSummary ?? { total: 0, pending: 0 }

  const formattedLastUpdated = useMemo(() => {
    if (!data?.lastUpdated) return null
    const parsed = new Date(data.lastUpdated)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
  }, [data?.lastUpdated])

  const summaryCards = useMemo(
    () => [
      {
        id: "pending-approvals",
        label: "Pending approvals",
        value: formatInteger(pendingApprovals),
        caption: "Records waiting for a decision",
        icon: ClipboardCheck,
      },
      {
        id: "pending-submissions",
        label: "Pending submissions",
        value: formatInteger(pendingSubmissions),
        caption: "Yields and prices awaiting review",
        icon: Activity,
      },
      {
        id: "technician-count",
        label: "Active technicians",
        value: formatInteger(technicianCount),
        caption: "Accounts across barangays",
        icon: UserCheck,
      },
      {
        id: "barangay-coverage",
        label: "Barangay coverage",
        value: `${formatInteger(barangayCount)} • ${formatPercentage(submissionRate)}`,
        caption: "Barangays with recent activity",
        icon: Users,
      },
    ],
    [barangayCount, pendingApprovals, pendingSubmissions, submissionRate, technicianCount],
  )

  const submissionsChartData = useMemo(
    () => [
      {
        category: "Yield submissions",
        total: Number(yieldSummary.total) || 0,
        pending: Number(yieldSummary.pending) || 0,
      },
      {
        category: "Price submissions",
        total: Number(priceSummary.total) || 0,
        pending: Number(priceSummary.pending) || 0,
      },
    ],
    [priceSummary.pending, priceSummary.total, yieldSummary.pending, yieldSummary.total],
  )

  const submissionsHaveData = submissionsChartData.some((item) => item.total || item.pending)

  const heatmap = data?.insights?.submissionHeatmap ?? { statuses: [], barangays: [] }
  const topPendingBarangays = useMemo(() => {
    const pendingKey = (heatmap.statuses ?? []).find((status) => String(status).toLowerCase().trim() === "pending")
    if (!pendingKey) return []

    return (heatmap.barangays ?? [])
      .map((row) => ({
        id: row.barangayId,
        name: row.barangayName,
        total: Number(row.total) || 0,
        pending: Number(row.counts?.[pendingKey]) || 0,
      }))
      .filter((row) => row.pending > 0)
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 6)
  }, [heatmap.barangays, heatmap.statuses])

  const topBarangays = useMemo(() => (data?.insights?.topBarangays?.barangays ?? []).slice(0, 6), [data?.insights?.topBarangays?.barangays])

  const barangaySeasonLabel = useMemo(() => {
    const season = data?.insights?.topBarangays?.season ?? {}
    if (!season.label && !season.year) return "All records"
    if (season.label && season.year) return `${season.label} • ${season.year}`
    return season.label || (season.year ? `Season ${season.year}` : "All records")
  }, [data?.insights?.topBarangays?.season])

  return (
    <section className="space-y-6 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-[32px] border border-emerald-200/65 bg-gradient-to-br from-emerald-500 via-emerald-400 to-teal-500 text-emerald-50 shadow-[0_40px_90px_-60px_rgba(16,185,129,0.75)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.35),_transparent_65%)]" />
        <div className="absolute -right-28 top-6 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -left-16 bottom-8 h-40 w-40 rounded-full bg-emerald-900/20 blur-3xl" />
        <div className="relative z-0 flex flex-col gap-8 px-6 py-8 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/90">
                Admin workspace
              </span>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">Keep barangay submissions moving</h1>
                <p className="text-sm text-emerald-50/85 sm:text-base">Review backlog, monitor technicians, and spot slow-moving barangays.</p>
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
            {summaryCards.map(({ id, label, value, caption, icon: Icon }) => {
              const IconComponent = Icon
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
                    <IconComponent className="h-5 w-5" />
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

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="space-y-4 rounded-2xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-emerald-900">Submission pipeline health</h2>
              <p className="text-sm text-emerald-600">Compare total submissions vs. pending reviews</p>
            </div>
          </header>

          {submissionsHaveData ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={submissionsChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(16, 185, 129, 0.18)" />
                <XAxis dataKey="category" stroke="#059669" tickLine={false} fontSize={12} />
                <YAxis stroke="#059669" tickLine={false} fontSize={12} />
                <Tooltip
                  cursor={{ fill: "rgba(16, 185, 129, 0.08)" }}
                  contentStyle={{ borderRadius: 12, borderColor: "rgba(16, 185, 129, 0.2)" }}
                  formatter={(value, name) => {
                    const label = name === "pending" ? "Pending" : "Total"
                    return [formatInteger(value), label]
                  }}
                />
                <Bar dataKey="total" fill="#059669" radius={[8, 8, 0, 0]} maxBarSize={72} />
                <Bar dataKey="pending" fill="#f59e0b" radius={[8, 8, 0, 0]} maxBarSize={72} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px]">
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-6 py-10 text-center text-sm text-emerald-700">
                <div className="mb-3 rounded-full bg-white p-2 text-emerald-500 shadow-inner shadow-emerald-200/60">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <p className="max-w-xs leading-relaxed">
                  Submission totals will appear once yield and price records are logged by technicians.
                </p>
              </div>
            </div>
          )}
        </article>

        <article className="space-y-4 rounded-2xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-emerald-900">Barangays with highest pending workload</h2>
              <p className="text-sm text-emerald-600">Focus on areas that need review attention</p>
            </div>
          </header>

          {topPendingBarangays.length ? (
            <ul className="space-y-3">
              {topPendingBarangays.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-emerald-100/70 bg-emerald-50/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">{row.name}</p>
                    <p className="text-xs text-emerald-500">{formatInteger(row.total)} total submissions</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-amber-600 shadow-inner shadow-amber-100/60">
                    {formatInteger(row.pending)} pending
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-6 py-10 text-center text-sm text-emerald-700">
              <div className="mb-3 rounded-full bg-white p-2 text-emerald-500 shadow-inner shadow-emerald-200/60">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <p className="max-w-xs leading-relaxed">
                Once barangay submissions arrive, the largest pending workloads will appear here.
              </p>
            </div>
          )}
        </article>
      </div>

      <article className="space-y-4 rounded-2xl border border-emerald-100/70 bg-white/90 p-6 shadow-sm shadow-emerald-900/5">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-emerald-900">Top performing barangays</h2>
            <p className="text-sm text-emerald-600">{barangaySeasonLabel}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100/80 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Sprout className="h-4 w-4" /> {formatTonnage(data?.insights?.topBarangays?.totalYield)} harvested
          </span>
        </header>

        {topBarangays.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topBarangays.map((barangay) => (
              <div key={barangay.barangayId} className="rounded-xl border border-emerald-100/80 bg-emerald-50/50 p-4">
                <p className="text-sm font-semibold text-emerald-900">{barangay.barangayName}</p>
                <p className="mt-1 text-xs text-emerald-500">{formatInteger(barangay.submissionCount)} submissions</p>
                <p className="mt-2 text-sm font-semibold text-emerald-700">{formatTonnage(barangay.totalYield)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-6 py-10 text-center text-sm text-emerald-700">
            <div className="mb-3 rounded-full bg-white p-2 text-emerald-500 shadow-inner shadow-emerald-200/60">
              <Sprout className="h-5 w-5" />
            </div>
            <p className="max-w-xs leading-relaxed">
              Once approved submissions are available, top barangays will show their harvest totals here.
            </p>
          </div>
        )}
      </article>
    </section>
  )
}
