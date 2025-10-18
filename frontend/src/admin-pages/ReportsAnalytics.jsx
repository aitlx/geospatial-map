import React, { useEffect, useMemo, useRef, useState } from "react"
import axios from "axios"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts"

// reports page - filters, preview, downloads

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 6 }).map((_, i) => String(CURRENT_YEAR - i))
const SEASONS = ["All", "Wet", "Dry"]

// escape csv values
const toCsvValue = (v) => {
  if (v === null || v === undefined) return ""
  const s = String(v)
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function ReportsAnalytics() {
  // Filters state
  const [reportType, setReportType] = useState("Yield Report")
  const [year, setYear] = useState(String(CURRENT_YEAR))
  const [season, setSeason] = useState("All")
  const [barangay, setBarangay] = useState("All")
  const [cropType, setCropType] = useState("All")

  // Data and loading/error state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null) // server result: { type: 'table'|'chart', rows: [...] }

  // Local dropdown lists (can be replaced by real backend endpoints)
  const [barangayOptions, setBarangayOptions] = useState(["All"])
  const [cropOptions, setCropOptions] = useState(["All"])

  // printable ref for print/export
  const printableRef = useRef(null)

  // load lookup lists (barangays, crops)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [bResp, cResp] = await Promise.allSettled([
          axios.get("/api/locations/barangays", { withCredentials: true }),
          axios.get("/api/crops/list", { withCredentials: true }),
        ])
        if (!mounted) return
        if (bResp.status === "fulfilled" && Array.isArray(bResp.value.data)) {
          setBarangayOptions(["All", ...bResp.value.data.map((b) => b.name)])
        }
        if (cResp.status === "fulfilled" && Array.isArray(cResp.value.data)) {
          setCropOptions(["All", ...cResp.value.data.map((c) => c.name)])
        }
      // eslint-disable-next-line no-unused-vars
      } catch (_err) {
        // silent fallback to defaults
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // generate report (calls /api/reports/generate)
  const handleGenerate = async () => {
    setError(null)
    setLoading(true)
    setData(null)
    try {
      const resp = await axios.get("/api/reports/generate", {
        params: {
          type: reportType,
          year: year === "All" ? undefined : year,
          season: season === "All" ? undefined : season,
          barangay: barangay === "All" ? undefined : barangay,
          crop: cropType === "All" ? undefined : cropType,
        },
        withCredentials: true,
      })

      // Expecting server response shape: { type: 'table'|'chart', rows: [...] }
      if (resp?.data) {
        setData(resp.data)
      } else {
        setData({ type: "table", rows: [{ note: "No data returned from server." }] })
      }
    // eslint-disable-next-line no-unused-vars
    } catch (_err) {
      setError("Failed to fetch report from server. You can try again.")
      setData({ type: "table", rows: [{ note: "Sample data here" }] })
    } finally {
      setLoading(false)
    }
  }

  // Download CSV helper
  const handleDownloadCSV = () => {
    if (!data || !Array.isArray(data.rows) || data.rows.length === 0) return
    const rows = data.rows
    const keys = Object.keys(rows[0])
    const csv = [keys.join(",")].concat(rows.map((r) => keys.map((k) => toCsvValue(r[k])).join(","))).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `report-${reportType.replace(/\s+/g, "-").toLowerCase()}-${year}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // download pdf (server-side ideally)
  const handleDownloadPDF = async () => {
    try {
      const resp = await axios.get("/api/reports/generate-pdf", {
        params: { type: reportType, year: year === "All" ? undefined : year, season: season === "All" ? undefined : season, barangay: barangay === "All" ? undefined : barangay, crop: cropType === "All" ? undefined : cropType },
        responseType: "blob",
        withCredentials: true,
      })
      const url = URL.createObjectURL(new Blob([resp.data], { type: "application/pdf" }))
      const a = document.createElement("a")
      a.href = url
      a.download = `report-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    // eslint-disable-next-line no-unused-vars
    } catch (_err) {
      // Fallback to printing the printable section if server-side PDF isn't available
      window.print()
    }
  }

  // preview renderer (table or chart)
  const preview = useMemo(() => {
    if (!data) {
      return <div className="p-6 text-sm text-slate-600">No report generated yet. Choose filters and click "Generate Report".</div>
    }

    if (data.type === "chart") {
      const chartData = Array.isArray(data.rows) ? data.rows.map((r) => ({ name: r.label || r.name || "", value: Number(r.value || r.count || 0) })) : []
      if (!chartData.length) return <div className="p-6 text-sm text-slate-600">Loading chart…</div>
      return (
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
    }

  // default table preview
    const rows = Array.isArray(data.rows) ? data.rows : []
    if (!rows.length) return <div className="p-6 text-sm text-slate-600">No data.</div>
    const keys = Object.keys(rows[0])
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-auto border-collapse">
          <thead className="text-left text-xs text-slate-600">
            <tr>{keys.map((k) => (<th key={k} className="border-b border-slate-200 px-3 py-2">{k}</th>))}</tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="odd:bg-white even:bg-slate-50">{keys.map((k) => (<td key={k} className="px-3 py-2">{String(r[k] ?? "")}</td>))}</tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }, [data])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* header */}
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-emerald-900">Reports and Data Summaries</h1>
        <p className="mt-1 text-sm text-slate-600">Generate and download summarized data based on yield, crops, or barangay performance.</p>
      </div>

  {/* filters */}
      <div className="rounded-lg border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Report</span>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="rounded-md border-gray-200 bg-white py-2 px-3 text-sm">
                <option>Yield Report</option>
                <option>Crop Report</option>
                <option>Seasonal Report</option>
                <option>Barangay Summary</option>
                <option>Market Prices</option>
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Year</span>
              <select value={year} onChange={(e) => setYear(e.target.value)} className="rounded-md border-gray-200 bg-white py-2 px-3 text-sm">
                <option>All</option>
                {YEAR_OPTIONS.map((y) => (<option key={y} value={y}>{y}</option>))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Season</span>
              <select value={season} onChange={(e) => setSeason(e.target.value)} className="rounded-md border-gray-200 bg-white py-2 px-3 text-sm">
                {SEASONS.map((s) => (<option key={s}>{s}</option>))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Barangay</span>
              <select value={barangay} onChange={(e) => setBarangay(e.target.value)} className="rounded-md border-gray-200 bg-white py-2 px-3 text-sm">
                {barangayOptions.map((b) => (<option key={b}>{b}</option>))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Crop</span>
              <select value={cropType} onChange={(e) => setCropType(e.target.value)} className="rounded-md border-gray-200 bg-white py-2 px-3 text-sm">
                {cropOptions.map((c) => (<option key={c}>{c}</option>))}
              </select>
            </label>
          </div>

          <div className="flex gap-2">
            <button onClick={handleGenerate} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
              {loading ? "Generating…" : "Generate Report"}
            </button>
            <button onClick={handleDownloadPDF} disabled={!data} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm">
              Download PDF
            </button>
            <button onClick={handleDownloadCSV} disabled={!data} className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm">
              Download CSV
            </button>
          </div>
        </div>
      </div>

  {/* preview */}
      <div className="mt-6 rounded-lg border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Preview</h2>
          <div className="text-sm text-slate-500">{data ? (data.rows?.length ?? 0) + " rows" : "No data"}</div>
        </div>

        <div className="mt-4">{error ? <div className="text-sm text-red-600">{error}</div> : preview}</div>
      </div>

      {/* printable footer */}
      <div ref={printableRef} className="mt-6 rounded-lg border border-emerald-100 bg-white p-4 shadow-sm print:bg-white">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div>
            <div className="text-xs text-slate-500">Prepared by</div>
            <div className="font-medium">{ /* replace with user name */ }Admin Name</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Approved by</div>
            <div className="font-medium">{ /* replace with signatory */ }Director</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Date generated</div>
            <div className="font-medium">{new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
