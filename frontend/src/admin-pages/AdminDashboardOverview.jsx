import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import axios from "axios"
import { Activity, AlertTriangle, ClipboardCheck, RefreshCcw, Sprout, UserCheck } from "lucide-react"

const numberFormatter = new Intl.NumberFormat("en-PH")
const decimalFormatter = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 })

const extractTopCrops = (payload) => {
	if (!payload) return []
	if (Array.isArray(payload?.results)) return payload.results
	if (Array.isArray(payload?.data?.results)) return payload.data.results
	if (Array.isArray(payload?.data)) return payload.data
	if (Array.isArray(payload)) return payload
	return []
}

const derivePendingTrend = (metrics) => {
	const seasons = metrics?.insights?.harvestComparison?.seasons ?? []
	return seasons.slice(0, 6).map((season) => ({
		label: season.label,
		pending: season.pending,
		approved: season.approved,
		totalYield: season.totalYield,
	}))
}

const deriveBarangayLeaders = (metrics) => {
	const items = metrics?.insights?.topBarangays?.barangays ?? []
	return items.slice(0, 6)
}

const safeNumber = (value) => {
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : 0
}

const buildRecentActivitySummary = (metrics) => {
	if (!metrics) return "No recent submissions yet."
	const pendingApprovals = safeNumber(metrics.pendingApprovals)
	const pendingSubmissions = safeNumber(metrics.pendingSubmissions)
	const rejected = safeNumber(metrics.rejectedSubmissions)

	if (pendingApprovals > 0) {
		return `${numberFormatter.format(pendingApprovals)} approvals awaiting review`
	}
	if (pendingSubmissions > 0) {
		return `${numberFormatter.format(pendingSubmissions)} submissions still in review`
	}
	if (rejected > 0) {
		return `${numberFormatter.format(rejected)} submissions rejected recently`
	}
	return "All caught up — no pending approvals right now."
}

const buildLastUpdated = (metrics) => {
	if (!metrics?.lastUpdated) return null
	const timestamp = new Date(metrics.lastUpdated)
	if (Number.isNaN(timestamp.getTime())) return null
	return timestamp.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
}

export default function AdminDashboardOverview() {
	const [metrics, setMetrics] = useState(null)
	const [topCrops, setTopCrops] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const mountedRef = useRef(false)

	const loadData = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			const [metricsResponse, topCropsResponse] = await Promise.all([
				axios.get("/api/dashboard/metrics", { withCredentials: true }),
				axios.get("/api/top-crops", { params: { limit: 5 }, withCredentials: true }),
			])

			if (!mountedRef.current) return

			const metricsPayload = metricsResponse?.data?.data ?? metricsResponse?.data ?? null
			setMetrics(metricsPayload)
			setTopCrops(extractTopCrops(topCropsResponse?.data))
		} catch (err) {
			if (!mountedRef.current) return
			setError(err?.response?.data?.message || err.message || "Unable to load admin dashboard data.")
			setMetrics(null)
			setTopCrops([])
		} finally {
			if (mountedRef.current) {
				setLoading(false)
			}
		}
	}, [])

	useEffect(() => {
		mountedRef.current = true
		loadData()
		return () => {
			mountedRef.current = false
		}
	}, [loadData])

	const pendingApprovals = safeNumber(metrics?.pendingApprovals)
	const technicianCount = safeNumber(metrics?.technicianCount)
	const pendingSubmissions = safeNumber(metrics?.pendingSubmissions)
	const yieldPending = safeNumber(metrics?.yieldSummary?.pending)
	const pricePending = safeNumber(metrics?.priceSummary?.pending)
	const barangayCount = safeNumber(metrics?.barangayCount)

	const pendingTrend = useMemo(() => derivePendingTrend(metrics), [metrics])
	const barangayLeaders = useMemo(() => deriveBarangayLeaders(metrics), [metrics])
	const recentActivity = useMemo(() => buildRecentActivitySummary(metrics), [metrics])
	const lastUpdated = useMemo(() => buildLastUpdated(metrics), [metrics])

	const maxPendingValue = Math.max(...pendingTrend.map((item) => safeNumber(item.pending)), 1)
	const topCrop = topCrops[0]
	const totalYieldKg = pendingTrend.reduce((sum, item) => sum + safeNumber(item.totalYield), 0)

	return (
		<section className="space-y-6">
			<header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">Admin workspace</p>
					<h1 className="mt-1 text-3xl font-semibold text-emerald-900">Operations dashboard</h1>
					<p className="mt-1 text-sm text-emerald-600">Monitor approvals, submissions, and crop health at a glance.</p>
				</div>
				<div className="flex items-center gap-3">
					{lastUpdated ? (
						<div className="rounded-full bg-emerald-100/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-700">
							Updated {lastUpdated}
						</div>
					) : null}
					<button
						type="button"
						onClick={loadData}
						disabled={loading}
						className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
					>
						<RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
						<span>{loading ? "Refreshing…" : "Refresh"}</span>
					</button>
				</div>
			</header>

			{error ? (
				<div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
					<AlertTriangle className="h-4 w-4" />
					<span>{error}</span>
				</div>
			) : null}

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-2xl bg-white/95 p-6 shadow-sm ring-1 ring-emerald-900/5">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-emerald-600">Pending approvals</p>
							<p className="mt-2 text-3xl font-bold text-emerald-900">{numberFormatter.format(pendingApprovals)}</p>
						</div>
						<span className="rounded-xl bg-amber-100 p-3 text-amber-600">
							<ClipboardCheck className="h-6 w-6" />
						</span>
					</div>
					<p className="mt-3 text-xs text-emerald-500">
						{numberFormatter.format(pendingSubmissions)} submissions queued ({numberFormatter.format(yieldPending)} yields · {numberFormatter.format(pricePending)} prices)
					</p>
				</div>

				<div className="rounded-2xl bg-white/95 p-6 shadow-sm ring-1 ring-emerald-900/5">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-emerald-600">Technician network</p>
							<p className="mt-2 text-3xl font-bold text-emerald-900">{numberFormatter.format(technicianCount)}</p>
						</div>
						<span className="rounded-xl bg-sky-100 p-3 text-sky-600">
							<UserCheck className="h-6 w-6" />
						</span>
					</div>
					<p className="mt-3 text-xs text-emerald-500">Covering {numberFormatter.format(barangayCount)} barangays in the network.</p>
				</div>

				<div className="rounded-2xl bg-white/95 p-6 shadow-sm ring-1 ring-emerald-900/5">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-emerald-600">Recent activity</p>
							<p className="mt-2 text-base font-semibold text-emerald-900">{recentActivity}</p>
						</div>
						<span className="rounded-xl bg-emerald-100 p-3 text-emerald-600">
							<Activity className="h-6 w-6" />
						</span>
					</div>
					<p className="mt-3 text-xs text-emerald-500">Stay on top of reviews to keep barangay dashboards current.</p>
				</div>

				<div className="rounded-2xl bg-white/95 p-6 shadow-sm ring-1 ring-emerald-900/5">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-emerald-600">Top recommended crop</p>
							<p className="mt-2 text-3xl font-bold text-emerald-900">
								{topCrop?.crop_name ?? "–"}
							</p>
						</div>
						<span className="rounded-xl bg-emerald-100 p-3 text-emerald-600">
							<Sprout className="h-6 w-6" />
						</span>
					</div>
					<p className="mt-3 text-xs text-emerald-500">
						{topCrop
							? `${decimalFormatter.format(safeNumber(topCrop.total_yield))} kg logged • ${numberFormatter.format(safeNumber(topCrop.report_count ?? topCrop.count ?? 0))} reports`
							: "Collect more yield data to surface insights."}
					</p>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<div className="rounded-2xl bg-white/95 p-6 shadow-sm ring-1 ring-emerald-900/5">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg font-semibold text-emerald-900">Pending approvals trend</h2>
							<p className="text-sm text-emerald-600">Compare pending vs approved yield tonnage by season.</p>
						</div>
						<div className="rounded-full bg-emerald-100/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
							{decimalFormatter.format(totalYieldKg)} kg total
						</div>
					</div>

					<div className="mt-6 h-72">
						<div className="flex h-full items-end justify-between gap-4">
							{pendingTrend.length ? (
								pendingTrend.map((entry) => {
									const pendingHeight = Math.max((safeNumber(entry.pending) / maxPendingValue) * 180, 6)
									const approvedHeight = Math.max((safeNumber(entry.approved) / maxPendingValue) * 180, 4)
									return (
										<div key={entry.label} className="flex flex-1 flex-col items-center gap-3">
											<div className="relative flex w-full flex-1 items-end justify-center">
												<div className="flex w-12 flex-col justify-end">
													<div
														className="relative flex-1 rounded-t-lg bg-amber-400/80"
														style={{ height: `${pendingHeight}px` }}
													>
														<span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-emerald-900">
															{decimalFormatter.format(safeNumber(entry.pending))}
														</span>
													</div>
													<div
														className="mt-1 flex-1 rounded-t-lg bg-emerald-400/80"
														style={{ height: `${approvedHeight}px` }}
													>
														<span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-emerald-900">
															{decimalFormatter.format(safeNumber(entry.approved))}
														</span>
													</div>
												</div>
											</div>
											<span className="text-xs font-medium text-emerald-600">{entry.label}</span>
										</div>
									)
								})
							) : (
								<div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60">
									<p className="text-sm text-emerald-600">No approved submissions recorded yet.</p>
								</div>
							)}
						</div>
					</div>
				</div>

				<div className="rounded-2xl bg-white/95 p-6 shadow-sm ring-1 ring-emerald-900/5">
					<h2 className="text-lg font-semibold text-emerald-900">Top barangay submissions</h2>
					<p className="text-sm text-emerald-600">Highest-yield barangays this season.</p>

					<div className="mt-6 space-y-4">
						{barangayLeaders.length ? (
							barangayLeaders.map((entry) => {
								const percentage = Math.min(
									100,
									metrics?.insights?.topBarangays?.maxYield
										? (safeNumber(entry.totalYield) / Math.max(safeNumber(metrics.insights.topBarangays.maxYield), 1)) * 100
									: 0,
								)
								return (
									<div key={entry.barangayId} className="space-y-2">
										<div className="flex items-center justify-between text-sm">
											<span className="font-medium text-emerald-900">{entry.barangayName}</span>
											<span className="text-emerald-600">{decimalFormatter.format(safeNumber(entry.totalYield))} kg</span>
										</div>
										<div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
											<div className="h-full rounded-full bg-emerald-500" style={{ width: `${percentage}%` }} />
										</div>
									</div>
								)
							})
						) : (
							<div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 text-sm text-emerald-600">
								No barangay submissions yet.
							</div>
						)}
					</div>
				</div>
			</div>

			<div className="rounded-2xl bg-white/95 p-6 shadow-sm ring-1 ring-emerald-900/5">
				<h2 className="text-lg font-semibold text-emerald-900">Crop recommendations spotlight</h2>
				<p className="text-sm text-emerald-600">Most recommended crops based on approved yields.</p>

				<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{topCrops.length ? (
						topCrops.map((crop) => (
							<div key={crop.crop_id ?? crop.cropId ?? crop.crop_name} className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
								<p className="text-sm font-semibold text-emerald-900">{crop.crop_name ?? crop.cropName}</p>
								<p className="mt-1 text-xs text-emerald-500">{decimalFormatter.format(safeNumber(crop.total_yield))} kg logged</p>
								<p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-emerald-500">
									{numberFormatter.format(safeNumber(crop.report_count ?? crop.count ?? 0))} reports
								</p>
							</div>
						))
					) : (
						<div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 text-sm text-emerald-600">
							Collect more data to unlock crop insights.
						</div>
					)}
				</div>
			</div>
		</section>
	)
}
