import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet"
import { Link, useLocation } from "react-router-dom"
import { ArrowLeft, ArrowRight, BarChart3, MapPin, ShieldCheck, Sparkles } from "lucide-react"
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

const DEFAULT_CENTER = [14.9649, 120.6074]
const MAX_PRICE_POINTS = 24
const YEAR_RANGE = (() => {
  const currentYear = new Date().getFullYear()
  const span = 6
  return Array.from({ length: span }, (_, index) => currentYear - (span - 1 - index))
})()
const SEASON_FILTERS = [
  { value: "all", label: "All seasons" },
  { value: "wet", label: "Wet season" },
  { value: "dry", label: "Dry season" },
]
const MONTH_OPTIONS = [
  { value: "", label: "All months" },
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
]
const INTERNAL_ROLE_IDS = new Set([1, 2, 3])

const monthLabelFromNumber = (monthValue) => {
  if (monthValue === null || monthValue === undefined) return null
  const matched = MONTH_OPTIONS.find((option) => option.value !== "" && Number(option.value) === Number(monthValue))
  return matched?.label ?? null
}

const numberFromValue = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

const pricePointTimestamp = (entry) => {
  if (!entry) return 0
  const recordedAt = typeof entry.recordedAt === "number" && Number.isFinite(entry.recordedAt) ? entry.recordedAt : null
  if (recordedAt) return recordedAt

  const year = numberFromValue(entry.year)
  const month = numberFromValue(entry.month)

  if (!Number.isFinite(year)) return 0

  const monthIndex = Number.isFinite(month) ? Math.max(0, Math.min(11, month - 1)) : 0
  return new Date(year, monthIndex, 1).getTime()
}

const normalizeBarangayName = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .replace(/\bsta\.?\b/g, "santa")
    .replace(/\bsto\.?\b/g, "santo")
    .replace(/\((.*?)\)/g, "-$1")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "barangay"

const escapeHtml = (input) => {
  if (input === null || input === undefined) return ""
  return input
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const formatMetric = (value, unit, decimals = 1) => {
  if (!Number.isFinite(value)) return "—"
  return `${value.toLocaleString("en-PH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${unit ? ` ${unit}` : ""}`
}

const formatSeasonTitle = (value) => {
  if (value === null || value === undefined) return null
  const raw = value.toString().trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
}

const buildPeriodDisplay = ({ month = null, season = null, year = null }) => {
  const parts = []
  const monthNumber = Number.isFinite(month) ? Number(month) : null
  if (monthNumber) {
    const monthName = monthLabelFromNumber(monthNumber)
    if (monthName) parts.push(monthName)
  }

  if (season) {
    const normalizedSeason = season.toString().trim().toLowerCase()
    if (normalizedSeason === "all") {
      parts.push("All seasons")
    } else {
      const seasonLabel = formatSeasonTitle(season)
      if (seasonLabel) parts.push(`${seasonLabel} season`)
    }
  }

  if (Number.isFinite(year)) {
    parts.push(String(year))
  }

  return parts.join(" • ")
}

const buildSelectedFilterLabel = ({ month, season, year }) => {
  const label = buildPeriodDisplay({ month, season, year })
  return label || "Latest available"
}

export default function GeospatialMap() {
  const [topCropsFilters, setTopCropsFilters] = useState({ year: YEAR_RANGE.at(-1), season: "all", month: "" })
  const [barangayData, setBarangayData] = useState([])
  const [geoJsonData, setGeoJsonData] = useState(null)
  const [geoJsonLoading, setGeoJsonLoading] = useState(true)
  const [mapLoading, setMapLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)
  const [selectedBarangayKey, setSelectedBarangayKey] = useState(null)
  const [hoveredBarangayKey, setHoveredBarangayKey] = useState(null)
  const [topCrops, setTopCrops] = useState([])
  const [topCropsLoading, setTopCropsLoading] = useState(false)
  const [topCropsError, setTopCropsError] = useState(null)
  const [bestCrop, setBestCrop] = useState(null)
  const [bestCropMeta, setBestCropMeta] = useState(null)
  const [bestCropLoading, setBestCropLoading] = useState(false)
  const [bestCropError, setBestCropError] = useState(null)
  const [cropPrices, setCropPrices] = useState([])
  const [cropPricesLoading, setCropPricesLoading] = useState(false)
  const [cropPricesError, setCropPricesError] = useState(null)
  const [cropPriceFilters, setCropPriceFilters] = useState({ crop: "all", month: "" })
  const [yieldSnapshots, setYieldSnapshots] = useState([])
  const [yieldSnapshotsLoading, setYieldSnapshotsLoading] = useState(false)
  const [yieldSnapshotsError, setYieldSnapshotsError] = useState(null)
  const [geospatialSummary, setGeospatialSummary] = useState(null)
  const [barangayMetrics, setBarangayMetrics] = useState(null)
  const [barangayMetricsLoading, setBarangayMetricsLoading] = useState(false)
  const [barangayMetricsError, setBarangayMetricsError] = useState(null)
  const [sessionRoleId, setSessionRoleId] = useState(null)
  const [logoutPending, setLogoutPending] = useState(false)

  const geoJsonLayerRef = useRef(null)
  const mapSectionRef = useRef(null)
  const skipSessionRefreshRef = useRef(false)

  const API_BASE_URL = useMemo(() => {
    const raw = import.meta.env.VITE_API_URL?.trim()
    if (!raw) return "http://localhost:5000/api"
    const normalized = raw.replace(/\/$/, "")
    return normalized.endsWith("/api") ? normalized : `${normalized}/api`
  }, [])

  const isAuthenticated = Number.isFinite(sessionRoleId)
  const isInternalRole = isAuthenticated && INTERNAL_ROLE_IDS.has(sessionRoleId)
  const location = useLocation()
  const cameFromHeader = location?.state?.fromHeader === true
  const isMapPath = (location?.pathname || "").toLowerCase().includes("/geospatial-map")
  // Hide the landing experience for internal roles OR whenever we're on the geospatial map route
  const showLandingExperience = !isInternalRole && !cameFromHeader && !isMapPath

  const syncRoleFromStorage = useCallback(() => {
    if (typeof window === "undefined") return false

    try {
      const cached = window.localStorage.getItem("user")
      if (!cached) {
        setSessionRoleId(null)
        return false
      }

      const parsed = JSON.parse(cached)
      const rawRole = parsed?.roleID ?? parsed?.roleid
      const numericRole =
        typeof rawRole === "number"
          ? rawRole
          : typeof rawRole === "string"
          ? Number.parseInt(rawRole, 10)
          : Number.NaN

      if (Number.isFinite(numericRole)) {
        setSessionRoleId(numericRole)
        return true
      }

      setSessionRoleId(null)
      return false
    } catch {
      setSessionRoleId(null)
      return false
    }
  }, [])

  const refreshSessionRole = useCallback(async (options = { force: false }) => {
    if (!options?.force && skipSessionRefreshRef.current) return

    const hasLocalSession = syncRoleFromStorage()
    if (hasLocalSession) {
      skipSessionRefreshRef.current = false
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/user/me`, { credentials: "include" })

      if (!response.ok) {
        if (response.status === 401) {
          setSessionRoleId(null)
          skipSessionRefreshRef.current = true
        }
        return
      }

      const payload = await response.json().catch(() => null)
      const candidateRole =
        payload?.data?.roleid ??
        payload?.data?.roleID ??
        payload?.roleid ??
        payload?.roleID ??
        null

      const numericRole =
        typeof candidateRole === "number"
          ? candidateRole
          : typeof candidateRole === "string"
          ? Number.parseInt(candidateRole, 10)
          : Number.NaN

      if (Number.isFinite(numericRole)) {
        skipSessionRefreshRef.current = false
        setSessionRoleId(numericRole)
      }
    } catch {
      setSessionRoleId(null)
      skipSessionRefreshRef.current = true
    }
  }, [API_BASE_URL, syncRoleFromStorage])

  const pesoFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
      }),
    []
  )

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }),
    []
  )

  const formatPrice = useCallback(
    (value) => (typeof value === "number" && Number.isFinite(value) ? pesoFormatter.format(value) : "—"),
    [pesoFormatter]
  )

  const renderCropPriceTooltip = useCallback(
    ({ active, payload, label }) => {
      if (!active || !payload || payload.length === 0) return null

      const dataPoint = payload[0]?.payload
      const season = dataPoint?.tooltipSeason
      const cropName = dataPoint?.tooltipCrop
      const period = dataPoint?.tooltipPeriod ?? label

      return (
        <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs shadow-md">
          <p className="font-semibold text-slate-700">{cropName || "Crop price"}</p>
          <p className="text-[11px] text-slate-500">
            {period}
            {season ? ` • ${season} season` : ""}
          </p>
          <p className="font-medium text-emerald-600">{formatPrice(payload[0].value)}</p>
        </div>
      )
    },
    [formatPrice]
  )

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    const hasSession = syncRoleFromStorage()
    if (hasSession) {
      refreshSessionRole()
    }

    if (typeof window === "undefined") return undefined

    const handleStorage = (event) => {
      if (!event || event.key === null || event.key === "user") {
        syncRoleFromStorage()
      }
    }

    const handleAuthLogin = () => {
      skipSessionRefreshRef.current = false
      refreshSessionRole({ force: true })
    }

    const handleProfileUpdated = () => {
      refreshSessionRole({ force: true })
    }

    const handleAuthLogout = () => {
      skipSessionRefreshRef.current = false
      syncRoleFromStorage()
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener("auth:login", handleAuthLogin)
    window.addEventListener("profile:updated", handleProfileUpdated)
    window.addEventListener("auth:logout", handleAuthLogout)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("auth:login", handleAuthLogin)
      window.removeEventListener("profile:updated", handleProfileUpdated)
      window.removeEventListener("auth:logout", handleAuthLogout)
    }
  }, [refreshSessionRole, syncRoleFromStorage])

  useEffect(() => {
    let isMounted = true

    const fetchBarangays = async () => {
      setMapLoading(true)
      try {
        const response = await fetch(`${API_BASE_URL}/barangays/dropdown`, {
          credentials: "include",
        })

        if (!response.ok) throw new Error(`Failed to load map data (status ${response.status})`)

        const payload = await response.json()
        const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []

        const mapped = rows
          .map((item, index) => {
            const rawName = item?.name ?? item?.adm3_en ?? item?.barangay ?? `Barangay ${index + 1}`
            const normalizedName = normalizeBarangayName(rawName) || `barangay-${index + 1}`
            const barangayId =
              numberFromValue(item?.barangayId) ??
              numberFromValue(item?.barangay_id) ??
              numberFromValue(item?.id)

            return {
              id: barangayId ?? `barangay-${index + 1}`,
              barangayId,
              normalizedName,
              name: rawName,
              coordinates: Array.isArray(item?.coordinates) ? item.coordinates : null,
              dominantCrop: item?.dominantCrop ?? item?.crop ?? "",
              averageYield: numberFromValue(item?.averageYield ?? item?.yield),
            }
          })
          .filter((item) => item.normalizedName)

        if (isMounted) {
          setBarangayData(mapped)
          if (mapped.length && !selectedBarangayKey) {
            setSelectedBarangayKey(mapped[0].normalizedName)
          }
        }
      } catch {
        if (isMounted) {
          setBarangayData([])
          setSelectedBarangayKey(null)
        }
      } finally {
        if (isMounted) setMapLoading(false)
      }
    }

    fetchBarangays()
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE_URL])

  useEffect(() => {
    let isMounted = true

    const loadGeoJson = async () => {
      try {
        const response = await fetch("/data/Guagua_barangays.geojson")
        if (!response.ok) throw new Error("Failed to load barangay boundaries")
        const data = await response.json()
        if (isMounted) setGeoJsonData(data)
      } catch {
        if (isMounted) setGeoJsonData(null)
      } finally {
        if (isMounted) setGeoJsonLoading(false)
      }
    }

    loadGeoJson()
    return () => {
      isMounted = false
    }
  }, [])

  const barangayLookup = useMemo(() => {
    const map = new Map()
    barangayData.forEach((item) => {
      const key = normalizeBarangayName(item.name)
      map.set(key, item)
    })
    return map
  }, [barangayData])

  const yieldSnapshotByBarangayId = useMemo(() => {
    const map = new Map()
    yieldSnapshots.forEach((snapshot) => {
      const barangayId = numberFromValue(snapshot?.barangayId)
      if (!barangayId) return
      const normalizedSeason = snapshot?.season ? snapshot.season.toString().trim().toLowerCase() : null

      map.set(barangayId, {
        ...snapshot,
        totalYield: Number.isFinite(snapshot?.totalYield) ? snapshot.totalYield : null,
        totalArea: Number.isFinite(snapshot?.totalArea) ? snapshot.totalArea : null,
        yieldPerHectare: Number.isFinite(snapshot?.yieldPerHectare) ? snapshot.yieldPerHectare : null,
        season: normalizedSeason,
      })
    })
    return map
  }, [yieldSnapshots])

  const choroplethData = useMemo(() => {
    if (!geoJsonData) return null

    return {
      ...geoJsonData,
      features: geoJsonData.features.map((feature, index) => {
        const properties = feature.properties ?? {}
        const rawName = properties.ADM4_EN ?? properties.ADM4 ?? properties.name ?? `Barangay ${index + 1}`
        const normalizedName = normalizeBarangayName(rawName)
        const apiRecord = barangayLookup.get(normalizedName)
        const barangayId = apiRecord?.barangayId ?? numberFromValue(properties.barangay_id)
        const snapshot = barangayId ? yieldSnapshotByBarangayId.get(barangayId) ?? null : null
        const snapshotYield = snapshot?.yieldPerHectare ?? null

        const layer = L.geoJSON(feature)
        const bounds = layer.getBounds()
        const centroid = bounds.isValid() ? bounds.getCenter() : null
        layer.remove()

        return {
          ...feature,
          properties: {
            ...properties,
            displayName: apiRecord?.name ?? rawName,
            normalizedName,
            dominantCrop: apiRecord?.dominantCrop ?? properties.dominantCrop ?? "",
            averageYield:
              Number.isFinite(snapshotYield) && snapshotYield !== null
                ? snapshotYield
                : apiRecord?.averageYield ?? properties.AREA_SQKM ?? 0,
            barangayId,
            yieldSnapshot: snapshot ?? null,
            centroid,
          },
        }
      }),
    }
  }, [geoJsonData, barangayLookup, yieldSnapshotByBarangayId])

  const choroplethCenters = useMemo(() => {
    const map = new Map()
    choroplethData?.features?.forEach((feature) => {
      const normalizedName = feature?.properties?.normalizedName
      const centroid = feature?.properties?.centroid
      if (normalizedName && centroid) {
        map.set(normalizedName, [centroid.lat, centroid.lng])
      }
    })
    return map
  }, [choroplethData])

  const combinedBarangays = useMemo(() => {
    const entries =
      choroplethData?.features?.map((feature, index) => {
        const normalizedName = feature?.properties?.normalizedName ?? normalizeBarangayName(`Barangay ${index + 1}`)
        const apiRecord = barangayLookup.get(normalizedName)
        const centroid = choroplethCenters.get(normalizedName)

        return {
          id: apiRecord?.id ?? normalizedName,
          barangayId: apiRecord?.barangayId ?? null,
          normalizedName,
          name: apiRecord?.name ?? feature?.properties?.displayName ?? `Barangay ${index + 1}`,
          dominantCrop: apiRecord?.dominantCrop ?? feature?.properties?.dominantCrop ?? "",
          averageYield: apiRecord?.averageYield ?? feature?.properties?.averageYield ?? 0,
          coordinates: apiRecord?.coordinates ?? centroid ?? null,
        }
      }) ?? []

    const extraBarangays = barangayData
      .filter((item) => !choroplethCenters.has(normalizeBarangayName(item.name)))
      .map((item) => ({
        id: item.id,
        barangayId: item.barangayId,
        normalizedName: normalizeBarangayName(item.name),
        name: item.name,
        dominantCrop: item.dominantCrop ?? "",
        averageYield: item.averageYield ?? 0,
        coordinates: item.coordinates ?? null,
      }))

    return [...entries, ...extraBarangays]
  }, [choroplethData, barangayLookup, choroplethCenters, barangayData])

  useEffect(() => {
    if (!combinedBarangays.length) return
    setSelectedBarangayKey((prev) => prev ?? combinedBarangays[0].normalizedName)
  }, [combinedBarangays])

  const selectedBarangayInfo = useMemo(() => {
    if (!selectedBarangayKey) return null
    const record = combinedBarangays.find((item) => item.normalizedName === selectedBarangayKey)
    return record ?? null
  }, [combinedBarangays, selectedBarangayKey])

  const selectedBarangayNumericId = useMemo(() => {
    if (!selectedBarangayInfo) return null
    return numberFromValue(selectedBarangayInfo.barangayId ?? selectedBarangayInfo.id)
  }, [selectedBarangayInfo])

  useEffect(() => {
    const controller = new AbortController()
    let isMounted = true

    const fetchTopCrops = async () => {
      if (!selectedBarangayNumericId) {
        setTopCrops([])
        setTopCropsError("Select a barangay to view its top crops.")
        setTopCropsLoading(false)
        return
      }

      setTopCropsLoading(true)
      setTopCropsError(null)

      const params = new URLSearchParams()
      params.set("barangayId", String(selectedBarangayNumericId))
      if (topCropsFilters?.year) params.set("year", String(topCropsFilters.year))
      if (topCropsFilters?.season && topCropsFilters.season.toLowerCase() !== "all") {
        params.set("season", topCropsFilters.season.toLowerCase())
      }
      if (topCropsFilters?.month) params.set("month", String(topCropsFilters.month))
      params.set("limit", "3")

      try {
        const response = await fetch(`${API_BASE_URL}/top-crops?${params.toString()}`, {
          credentials: "include",
          signal: controller.signal,
        })

        if (response.status === 401) {
          if (isMounted) {
            setTopCrops([])
            setTopCropsError("Top crops data is currently unavailable.")
          }
          return
        }

        if (!response.ok) throw new Error(`Failed to load top crops (status ${response.status})`)

        const payload = await response.json()
        const data = Array.isArray(payload?.data?.results)
          ? payload.data.results
          : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.results)
          ? payload.results
          : []

        const normalized = data
          .map((entry) => ({
            cropId: entry?.crop_id ?? entry?.cropId ?? null,
            cropName: entry?.crop_name ?? entry?.cropName ?? "Unknown crop",
            totalYield: Number(entry?.total_yield ?? entry?.totalYield ?? entry?.total ?? 0),
          }))
          .filter((entry) => entry.cropName)

        if (isMounted) setTopCrops(normalized)
      } catch (error) {
        if (error.name === "AbortError") return
        if (isMounted) {
          setTopCrops([])
          setTopCropsError("No data yet for this filter.")
        }
      } finally {
        if (isMounted) setTopCropsLoading(false)
      }
    }

    fetchTopCrops()
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [API_BASE_URL, selectedBarangayNumericId, topCropsFilters.year, topCropsFilters.season, topCropsFilters.month])

  useEffect(() => {
    const controller = new AbortController()
    let isMounted = true

    const loadCropPrices = async () => {
      if (!selectedBarangayNumericId) {
        setCropPrices([])
        setCropPricesError(null)
        setCropPricesLoading(false)
        return
      }

      setCropPricesLoading(true)
      setCropPricesError(null)

      try {
        const response = await fetch(`${API_BASE_URL}/barangay-crop-prices?status=approved`, {
          credentials: "include",
          signal: controller.signal,
        })

        if (response.status === 401) {
          if (isMounted) {
            setCropPrices([])
            setCropPricesError("Price submissions are currently unavailable.")
          }
          return
        }

        if (!response.ok) throw new Error(`Failed to load crop prices (status ${response.status})`)

        const payload = await response.json()
        const rows = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload)
          ? payload
          : []

        const normalized = rows
          .map((entry, index) => {
            const barangayId = numberFromValue(entry?.barangay_id ?? entry?.barangayId ?? entry?.barangay?.id)
            const cropName = entry?.crop?.name ?? entry?.crop_name ?? entry?.crop ?? null
            const fallbackId = `${barangayId ?? "barangay"}-${entry?.crop_id ?? entry?.cropId ?? index}`
            const recordedRaw =
              entry?.date_recorded ?? entry?.recorded_at ?? entry?.created_at ?? entry?.updated_at ?? null
            const recordedDate = recordedRaw ? new Date(recordedRaw) : null
            const recordedTimestamp = recordedDate && Number.isFinite(recordedDate.getTime()) ? recordedDate.getTime() : null
            const monthValue =
              numberFromValue(entry?.month ?? entry?.period?.month ?? (recordedDate ? recordedDate.getMonth() + 1 : null)) ??
              null

            return {
              id: entry?.price_id ?? entry?.id ?? fallbackId,
              barangayId,
              barangayName: entry?.barangay?.name ?? entry?.barangay_name ?? entry?.barangay ?? "",
              cropName,
              price: Number(entry?.price_per_kg ?? entry?.pricePerKg ?? entry?.price ?? NaN),
              season: (entry?.season ?? "").toString(),
              year: numberFromValue(entry?.year),
              recordedAt: recordedTimestamp,
              month: monthValue,
              monthLabel: monthLabelFromNumber(monthValue),
              status: (entry?.status ?? "").toLowerCase(),
            }
          })
          .filter((item) => item.cropName && Number.isFinite(item.price) && item.status === "approved")

        const filtered = normalized.filter((item) => item.barangayId === selectedBarangayNumericId)

        const sorted = filtered.sort((a, b) => {
          const timeA = Number.isFinite(a.recordedAt) ? a.recordedAt : 0
          const timeB = Number.isFinite(b.recordedAt) ? b.recordedAt : 0
          return timeB - timeA
        })

        if (isMounted) {
          setCropPrices(sorted)
          setCropPricesError(null)
        }
      } catch (error) {
        if (error.name === "AbortError") return
        if (isMounted) {
          setCropPrices([])
          setCropPricesError("Unable to load crop prices right now.")
        }
      } finally {
        if (isMounted) setCropPricesLoading(false)
      }
    }

    loadCropPrices()
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [API_BASE_URL, selectedBarangayNumericId])

  const selectedPeriod = useMemo(() => {
    const year = numberFromValue(topCropsFilters.year)
    const month = numberFromValue(topCropsFilters.month)
    const seasonRaw = topCropsFilters.season ? topCropsFilters.season.toString().toLowerCase() : ""
    const season = seasonRaw && seasonRaw !== "all" ? seasonRaw : null

    return {
      year: Number.isFinite(year) ? year : null,
      month: Number.isFinite(month) ? month : null,
      season,
    }
  }, [topCropsFilters.month, topCropsFilters.season, topCropsFilters.year])

  const periodLabel = useMemo(() => {
    const seasonRaw = topCropsFilters.season ? topCropsFilters.season.toString().toLowerCase() : null
    return buildSelectedFilterLabel({
      month: selectedPeriod.month,
      season: seasonRaw === "all" ? "all" : selectedPeriod.season,
      year: selectedPeriod.year,
    })
  }, [selectedPeriod, topCropsFilters.season])

  useEffect(() => {
    const controller = new AbortController()
    let isMounted = true

    const fetchYieldSnapshots = async () => {
      setYieldSnapshotsLoading(true)
      setYieldSnapshotsError(null)

      try {
        const params = new URLSearchParams()
        if (Number.isFinite(selectedPeriod.year)) params.set("year", String(selectedPeriod.year))
        if (Number.isFinite(selectedPeriod.month)) params.set("month", String(selectedPeriod.month))
        if (selectedPeriod.season) params.set("season", selectedPeriod.season)

        const queryString = params.toString()
        const response = await fetch(
          `${API_BASE_URL}/geospatial/barangay-snapshots${queryString ? `?${queryString}` : ""}`,
          {
          credentials: "include",
          signal: controller.signal,
          }
        )

        if (!response.ok) throw new Error(`Failed to load barangay snapshots (status ${response.status})`)

        const payload = await response.json().catch(() => null)
        const snapshots = Array.isArray(payload?.data?.snapshots)
          ? payload.data.snapshots
          : Array.isArray(payload?.snapshots)
          ? payload.snapshots
          : Array.isArray(payload)
          ? payload
          : []

        const normalizedSnapshots = snapshots
          .map((entry) => {
            const barangayId = numberFromValue(entry?.barangayId ?? entry?.barangay_id)
            if (!barangayId) return null

            const totalYield = Number(entry?.totalYield ?? entry?.total_yield)
            const totalArea = Number(entry?.totalArea ?? entry?.total_area ?? entry?.total_area_planted_ha)
            const yieldPerHectare = Number(entry?.yieldPerHectare ?? entry?.yield_per_hectare)

            return {
              barangayId,
              barangayName: entry?.barangayName ?? entry?.barangay_name ?? null,
              totalYield: Number.isFinite(totalYield) ? totalYield : null,
              totalArea: Number.isFinite(totalArea) ? totalArea : null,
              yieldPerHectare: Number.isFinite(yieldPerHectare) ? yieldPerHectare : null,
              year: numberFromValue(entry?.year),
              month: numberFromValue(entry?.month),
              season: entry?.season ? entry.season.toString().trim().toLowerCase() : null,
              updatedAt: entry?.updatedAt ?? entry?.updated_at ?? null,
            }
          })
          .filter(Boolean)

        const summary = payload?.data?.summary ?? payload?.summary ?? null

        if (isMounted) {
          setYieldSnapshots(normalizedSnapshots)
          setGeospatialSummary(summary)
        }
      } catch (error) {
        if (error.name === "AbortError") return
        if (isMounted) {
          setYieldSnapshots([])
          setYieldSnapshotsError("Unable to load barangay yield snapshots right now.")
        }
      } finally {
        if (isMounted) setYieldSnapshotsLoading(false)
      }
    }

    fetchYieldSnapshots()
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [API_BASE_URL, selectedPeriod.month, selectedPeriod.season, selectedPeriod.year])

  useEffect(() => {
    if (!selectedBarangayNumericId) {
      setBarangayMetrics(null)
      setBarangayMetricsLoading(false)
      return
    }

    const controller = new AbortController()
    let isMounted = true

    const fetchBarangayMetrics = async () => {
      setBarangayMetricsLoading(true)
      setBarangayMetricsError(null)

      const params = new URLSearchParams()
      if (Number.isFinite(selectedPeriod.year)) params.set("year", String(selectedPeriod.year))
      if (Number.isFinite(selectedPeriod.month)) params.set("month", String(selectedPeriod.month))
      if (selectedPeriod.season) params.set("season", selectedPeriod.season)
      params.set("limit", "12")

      try {
        const response = await fetch(
          `${API_BASE_URL}/geospatial/barangays/${selectedBarangayNumericId}/metrics?${params.toString()}`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        )

        if (!response.ok) throw new Error(`Failed to load barangay metrics (status ${response.status})`)

        const payload = await response.json().catch(() => null)
        const metrics = payload?.data ?? payload ?? null

        if (isMounted) {
          setBarangayMetrics(metrics)
        }
      } catch (error) {
        if (error.name === "AbortError") return
        if (isMounted) {
          setBarangayMetrics(null)
          setBarangayMetricsError("Barangay metrics are unavailable right now.")
        }
      } finally {
        if (isMounted) setBarangayMetricsLoading(false)
      }
    }

    fetchBarangayMetrics()
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [API_BASE_URL, selectedBarangayNumericId, selectedPeriod.month, selectedPeriod.season, selectedPeriod.year])

  const barangayYieldSummaryByKey = useMemo(() => {
    const summaryMap = new Map()
    combinedBarangays.forEach((entry) => {
      if (!entry) return
      const normalizedName = entry.normalizedName ?? normalizeBarangayName(entry.name)
      if (!normalizedName) return

      const barangayId = numberFromValue(entry.barangayId ?? entry.id)
      const snapshot = barangayId ? yieldSnapshotByBarangayId.get(barangayId) ?? null : null
      if (snapshot) {
        summaryMap.set(normalizedName, snapshot)
      }
    })
    return summaryMap
  }, [combinedBarangays, yieldSnapshotByBarangayId])

  const selectedBarangayYieldSummary = useMemo(() => {
    if (!selectedBarangayNumericId) return null

    if (barangayMetrics?.current) return barangayMetrics.current
    if (barangayMetrics?.latest) return barangayMetrics.latest

    const snapshotById = yieldSnapshotByBarangayId.get(selectedBarangayNumericId)
    if (snapshotById) return snapshotById

    if (selectedBarangayKey) {
      return barangayYieldSummaryByKey.get(selectedBarangayKey) ?? null
    }

    return null
  }, [
    barangayMetrics,
    barangayYieldSummaryByKey,
    selectedBarangayKey,
    selectedBarangayNumericId,
    yieldSnapshotByBarangayId,
  ])

  const barangayYieldsLoading = yieldSnapshotsLoading || barangayMetricsLoading

  const recommendationParams = useMemo(() => {
    if (!selectedBarangayNumericId) return null

    const seasonFromFilters = selectedPeriod.season ?? null
    const summarySeason = selectedBarangayYieldSummary?.season
      ? selectedBarangayYieldSummary.season.toString().trim().toLowerCase()
      : null

    let chosenSeason = seasonFromFilters
    let seasonSource = "filters"

    if (!chosenSeason || chosenSeason === "all") {
      chosenSeason = summarySeason && summarySeason !== "all" ? summarySeason : null
      seasonSource = chosenSeason ? "summary" : "none"
    }

    if (!chosenSeason) return null

    const summaryYear = numberFromValue(selectedBarangayYieldSummary?.year)
    const currentYear = new Date().getFullYear()
    const chosenYear = Number.isFinite(selectedPeriod.year)
      ? selectedPeriod.year
      : Number.isFinite(summaryYear)
      ? summaryYear
      : currentYear

    return {
      barangayId: selectedBarangayNumericId,
      season: chosenSeason,
      year: chosenYear,
      seasonSource,
      yearSource: Number.isFinite(selectedPeriod.year)
        ? "filters"
        : Number.isFinite(summaryYear)
        ? "summary"
        : "current",
    }
  }, [selectedBarangayNumericId, selectedBarangayYieldSummary, selectedPeriod])

  useEffect(() => {
    if (!selectedBarangayNumericId) {
      setBestCrop(null)
      setBestCropMeta(null)
      setBestCropError(null)
      setBestCropLoading(false)
      return
    }

    if (!recommendationParams) {
      setBestCrop(null)
      setBestCropMeta(null)
      setBestCropError("Select a season to preview recommendations.")
      setBestCropLoading(false)
      return
    }

    const controller = new AbortController()
    let isMounted = true

    const fetchBestCrop = async () => {
      setBestCropLoading(true)
      setBestCropError(null)

      const query = new URLSearchParams()
      query.set("season", recommendationParams.season)
      query.set("year", String(recommendationParams.year))

      try {
        const response = await fetch(
          `${API_BASE_URL}/recommendations/barangays/${recommendationParams.barangayId}/best?${query.toString()}`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        )

        if (response.status === 404) {
          if (isMounted) {
            setBestCrop(null)
            setBestCropMeta(null)
            setBestCropError("No recommendation available yet for this barangay.")
          }
          return
        }

        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          const backendMessage = payload?.message ?? `Failed to fetch crop recommendation (status ${response.status})`
          const details = payload?.details ?? null
          const suggestion =
            typeof details?.suggestion === "string" && details.suggestion.trim().length > 0
              ? details.suggestion.trim()
              : null
          const combinedMessage = suggestion ? `${backendMessage} ${suggestion}` : backendMessage

          if (isMounted) {
            setBestCrop(null)
            setBestCropMeta(details ? { errorDetails: details } : null)
            setBestCropError(combinedMessage)
          }
          return
        }

        const resultCandidate = payload?.data?.result ?? payload?.data ?? payload?.result ?? null
        const meta = payload?.data?.meta ?? payload?.meta ?? null

        if (!resultCandidate) {
          if (isMounted) {
            setBestCrop(null)
            setBestCropMeta(meta)
            setBestCropError("Recommendation response was empty.")
          }
          return
        }

        const normalizedBest = {
          barangayId: resultCandidate.barangayId ?? resultCandidate.barangay_id ?? recommendationParams.barangayId,
          barangayName: resultCandidate.barangayName ?? resultCandidate.barangay_name ?? selectedBarangayInfo?.name ?? null,
          cropId: numberFromValue(resultCandidate.cropId ?? resultCandidate.crop_id),
          cropName: resultCandidate.cropName ?? resultCandidate.crop_name ?? "—",
          season: resultCandidate.season ?? recommendationParams.season,
          year: numberFromValue(resultCandidate.year ?? recommendationParams.year),
          source: resultCandidate.source ?? "ml-api",
          fallback: Boolean(resultCandidate.fallback),
          refreshedAt: resultCandidate.refreshedAt ?? resultCandidate.updated_at ?? null,
        }

        if (isMounted) {
          setBestCrop(normalizedBest)
          setBestCropMeta(meta)
          setBestCropError(null)
        }
      } catch (error) {
        if (error.name === "AbortError") return
        if (isMounted) {
          setBestCrop(null)
          setBestCropMeta(null)
          setBestCropError("Unable to load crop recommendation right now.")
        }
      } finally {
        if (isMounted) setBestCropLoading(false)
      }
    }

    fetchBestCrop()
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [API_BASE_URL, recommendationParams, selectedBarangayInfo, selectedBarangayNumericId])

  const isNeutralRecommendationMessage =
    typeof bestCropError === "string" &&
    (bestCropError.startsWith("Select") || bestCropError.startsWith("No recommendation"))

  const bestCropRefreshedLabel = useMemo(() => {
    if (!bestCrop?.refreshedAt) return null
    const parsed = new Date(bestCrop.refreshedAt)
    if (Number.isNaN(parsed.getTime())) return null
    return dateFormatter.format(parsed)
  }, [bestCrop, dateFormatter])

  const bestCropSubtitle = useMemo(() => {
    if (!bestCrop) return null
    const parts = []
    const seasonLabel = formatSeasonTitle(bestCrop.season)

    if (seasonLabel) parts.push(`${seasonLabel} season`)
    else if (bestCrop.season) parts.push(bestCrop.season)

    if (Number.isFinite(bestCrop.year)) parts.push(String(bestCrop.year))

    return parts.join(" • ") || null
  }, [bestCrop])

  const cropFilterOptions = useMemo(() => {
    const names = new Set()
    cropPrices.forEach((item) => {
      if (item?.cropName) names.add(item.cropName)
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [cropPrices])

  const filteredCropPrices = useMemo(() => {
    let list = [...cropPrices]

    if (cropPriceFilters.crop !== "all") {
      list = list.filter((item) => item.cropName === cropPriceFilters.crop)
    }

    if (cropPriceFilters.month) {
      const monthNumber = Number.parseInt(cropPriceFilters.month, 10)
      if (Number.isFinite(monthNumber)) {
        list = list.filter((item) => item.month === monthNumber)
      }
    }

    return list.slice(0, MAX_PRICE_POINTS)
  }, [cropPrices, cropPriceFilters])

  const cropPriceChartData = useMemo(() => {
    if (!filteredCropPrices.length) return []

    const sortedAscending = [...filteredCropPrices].sort(
      (a, b) => pricePointTimestamp(a) - pricePointTimestamp(b)
    )

    return sortedAscending.map((item, index) => {
      const seasonLabel = item.season ? formatSeasonTitle(item.season) : null
      const periodLabel = buildPeriodDisplay({
        month: item.month,
        season: item.season,
        year: item.year,
      })

      const fallbackDate =
        typeof item.recordedAt === "number" && Number.isFinite(item.recordedAt)
          ? dateFormatter.format(new Date(item.recordedAt))
          : null

      const label = periodLabel || fallbackDate || `Point ${index + 1}`

      return {
        label,
        price: item.price,
        tooltipSeason: seasonLabel,
        tooltipCrop: item.cropName ?? "",
        tooltipPeriod: periodLabel || fallbackDate,
      }
    })
  }, [dateFormatter, filteredCropPrices])

  const latestCropPrice = filteredCropPrices.length > 0 ? filteredCropPrices[0] : null
  const latestCropPriceLabel = useMemo(() => {
    if (!latestCropPrice) return null
    return buildPeriodDisplay({
      month: latestCropPrice.month,
      season: latestCropPrice.season,
      year: latestCropPrice.year,
    })
  }, [latestCropPrice])

  useEffect(() => {
    setCropPriceFilters((prev) => ({ ...prev, crop: "all", month: "" }))
  }, [selectedBarangayNumericId])

  const yieldRange = useMemo(() => {
    if (!choroplethData) return { min: 0, max: 0 }
    const values = choroplethData.features
      .map((feature) => Number(feature.properties?.averageYield))
      .filter((value) => Number.isFinite(value))
    if (!values.length) return { min: 0, max: 0 }
    return { min: Math.min(...values), max: Math.max(...values) }
  }, [choroplethData])

  const yieldRangeLabels = useMemo(
    () => ({
      min: Number.isFinite(yieldRange.min) ? yieldRange.min.toFixed(1) : "0.0",
      max: Number.isFinite(yieldRange.max) ? yieldRange.max.toFixed(1) : "0.0",
    }),
    [yieldRange]
  )

  const getChoroplethColor = useCallback(
    (value) => {
      const { min, max } = yieldRange
      const numericValue = Number(value)
      if (!Number.isFinite(numericValue)) return "#bbf7d0"
      if (max === min) return "#6ee7b7"
      const ratio = Math.min(1, Math.max(0, (numericValue - min) / (max - min || 1)))
      const start = [16, 185, 129]
      const end = [6, 78, 59]
      const toHex = (component) => component.toString(16).padStart(2, "0")
      const interpolate = (index) => Math.round(start[index] + (end[index] - start[index]) * ratio)
      return `#${[0, 1, 2].map((index) => toHex(interpolate(index))).join("")}`
    },
    [yieldRange]
  )

  const geoJsonStyle = useCallback(
    (feature) => {
      const normalizedName = feature?.properties?.normalizedName
      const averageYield = feature?.properties?.averageYield ?? 0
      const isSelected = normalizedName && normalizedName === selectedBarangayKey
      const isHovered = normalizedName && normalizedName === hoveredBarangayKey

      return {
        color: isSelected ? "#065f46" : "#0f766e",
        weight: isSelected ? 3 : isHovered ? 2 : 1,
        fillColor: getChoroplethColor(averageYield),
        fillOpacity: isSelected ? 0.75 : isHovered ? 0.65 : 0.55,
        dashArray: isSelected ? "" : "2 4",
      }
    },
    [getChoroplethColor, hoveredBarangayKey, selectedBarangayKey]
  )

  const handleEachFeature = useCallback(
    (feature, layer) => {
      const normalizedName = feature?.properties?.normalizedName ?? normalizeBarangayName(feature?.properties?.ADM4_EN ?? "")
      const cropLabel = feature?.properties?.dominantCrop ?? "N/A"
      const displayName = feature?.properties?.displayName ?? "Barangay"
      const summary = barangayYieldSummaryByKey.get(normalizedName)

      const yieldDisplay = formatMetric(summary?.totalYield, "MT")
      const areaDisplay = formatMetric(summary?.totalArea, "ha")
      const perHaDisplay = formatMetric(summary?.yieldPerHectare, "MT/ha", 2)
      const hasApprovedData = [yieldDisplay, areaDisplay, perHaDisplay].some((value) => value !== "—")

      const summaryPeriodLabel = summary
        ? buildPeriodDisplay({ month: summary.month, season: summary.season, year: summary.year })
        : null
      const headlineLabel = summaryPeriodLabel || periodLabel || null
      const periodHeadline = headlineLabel
        ? `<p class="text-[10px] font-medium uppercase tracking-[0.24em] text-emerald-600">${escapeHtml(headlineLabel)}</p>`
        : ""

      const noDataLabel = summaryPeriodLabel || periodLabel || "this period"
      const metricsMarkup = hasApprovedData
        ? `<dl class="mt-1.5 space-y-1 text-[11px] text-slate-700">
              <div class="flex items-center justify-between gap-4">
                <dt class="text-[10px] uppercase tracking-wide text-slate-500">Yield</dt>
                <dd class="font-semibold text-slate-900">${escapeHtml(yieldDisplay)}</dd>
              </div>
              <div class="flex items-center justify-between gap-4">
                <dt class="text-[10px] uppercase tracking-wide text-slate-500">Area planted</dt>
                <dd class="font-semibold text-slate-900">${escapeHtml(areaDisplay)}</dd>
              </div>
              <div class="flex items-center justify-between gap-4">
                <dt class="text-[10px] uppercase tracking-wide text-slate-500">Yield per ha</dt>
                <dd class="font-semibold text-slate-900">${escapeHtml(perHaDisplay)}</dd>
              </div>
            </dl>`
        : `<p class="mt-1.5 text-[11px] text-slate-500">No approved yield data for ${escapeHtml(noDataLabel)} yet.</p>`

      layer.on({
        click: (event) => {
          L.DomEvent.stopPropagation(event)
          setSelectedBarangayKey((prev) => {
            if (prev === normalizedName) return prev
            return normalizedName
          })
          const targetLayer = event?.target ?? layer
          if (!targetLayer.isPopupOpen()) {
            targetLayer.openPopup()
          }
        },
        mouseover: (event) => {
          setHoveredBarangayKey(normalizedName)
          event.target.setStyle({
            weight: 2.5,
            fillOpacity: 0.7,
          })
          if (event.target.bringToFront) {
            event.target.bringToFront()
          }
        },
        mouseout: (event) => {
          setHoveredBarangayKey((current) => (current === normalizedName ? null : current))
          geoJsonLayerRef.current?.resetStyle(event.target)
        },
      })

      layer.bindPopup(
        `<div class="min-w-[180px] space-y-1.5 text-xs leading-snug text-slate-700">
          <div class="space-y-0.5">
            <p class="text-sm font-semibold text-slate-900">${escapeHtml(displayName)}</p>
            ${periodHeadline}
          </div>
          <p class="text-[11px] text-slate-500">Dominant crop: <span class="font-semibold text-slate-700">${escapeHtml(cropLabel)}</span></p>
          ${metricsMarkup}
        </div>`,
        {
          autoPan: false,
        }
      )
    },
    [barangayYieldSummaryByKey, geoJsonLayerRef, periodLabel]
  )

  const mapIsLoading = mapLoading || geoJsonLoading || yieldSnapshotsLoading
  const barangayCount = combinedBarangays.length
  const isAdminSession = sessionRoleId === 1 || sessionRoleId === 2
  const dashboardHref = isAdminSession ? "/admin/dashboard" : "/Dashboard"

  const statCards = useMemo(() => {
    const barangaysWithApproved = Number.isFinite(geospatialSummary?.barangaysWithApprovedYields)
      ? geospatialSummary.barangaysWithApprovedYields
      : barangayCount

    const yieldValue = Number.isFinite(selectedBarangayYieldSummary?.totalYield)
      ? formatMetric(selectedBarangayYieldSummary.totalYield, "MT")
      : barangayYieldsLoading
      ? "Loading…"
      : barangayMetricsError
      ? "Awaiting field reports"
      : "—"
    const areaDisplay = formatMetric(selectedBarangayYieldSummary?.totalArea, "ha")

    const summaryPeriodLabel = selectedBarangayYieldSummary
      ? buildPeriodDisplay({
          month: selectedBarangayYieldSummary.month,
          season: selectedBarangayYieldSummary.season,
          year: selectedBarangayYieldSummary.year,
        })
      : null

    const yieldCaptionParts = [
      selectedBarangayInfo?.name,
      summaryPeriodLabel || periodLabel,
      areaDisplay !== "—" ? `Area ${areaDisplay}` : null,
    ].filter(Boolean)

    return [
      {
        id: "barangays",
        label: "Barangays tracked",
        value: barangaysWithApproved ? barangaysWithApproved.toLocaleString("en-US") : "—",
        icon: MapPin,
        caption: periodLabel ? `Active monitoring • ${periodLabel}` : "Active monitoring coverage",
      },
      {
        id: "yield",
        label: "Yield this period",
        value: mapIsLoading || barangayYieldsLoading ? "…" : yieldValue,
        icon: BarChart3,
        caption:
          yieldCaptionParts.length > 0
            ? yieldCaptionParts.join(" • ")
            : yieldSnapshotsError
            ? "Yield data is currently unavailable"
            : "Select a barangay to view approved totals",
      },
    ]
  }, [
    barangayCount,
    barangayMetricsError,
    barangayYieldsLoading,
    geospatialSummary,
    mapIsLoading,
    periodLabel,
    selectedBarangayInfo,
    selectedBarangayYieldSummary,
    yieldSnapshotsError,
  ])

  const handleScrollToMap = useCallback(() => {
    if (mapSectionRef.current) {
      mapSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [])

  const handleLandingLogout = useCallback(async () => {
    if (logoutPending) return
    setLogoutPending(true)

    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      })
    } catch {
      /* ignore logout cleanup errors */
    } finally {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("user")
        window.localStorage.removeItem("token")
        window.dispatchEvent(new Event("auth:logout"))
      }
      syncRoleFromStorage()
      setLogoutPending(false)
    }
  }, [API_BASE_URL, logoutPending, syncRoleFromStorage])

  const aboutDescription = `The municipal geospatial view blends barangay boundaries, yield performance, and market signals so teams can respond quickly to shifting conditions. Select any barangay to inspect localized recommendations and latest price updates.`

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-emerald-50/40 to-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_55%)]" />
      <div className="pointer-events-none absolute -right-24 top-16 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />

      {showLandingExperience && (
        <header className="sticky top-0 z-30 border-b border-white/10 bg-white/60 backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
            <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8.5L12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
                  <path d="M12 12l8-4.5" />
                  <path d="M12 12v8" />
                  <path d="M12 12L4 7.5" />
                </svg>
              </div>
              <span className="text-base font-semibold text-slate-900">Geoagritech</span>
            </Link>
            {isAuthenticated && (
              <div className="flex items-center gap-3">
                <Link
                  to={dashboardHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
                >
                  Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={handleLandingLogout}
                  disabled={logoutPending}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {logoutPending ? "Logging out…" : "Logout"}
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      {!showLandingExperience && (
        <header className="sticky top-0 z-30 border-b border-emerald-100/70 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-3 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8.5L12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
                  <path d="M12 12l8-4.5" />
                  <path d="M12 12v8" />
                  <path d="M12 12L4 7.5" />
                </svg>
              </div>
              <div className="leading-tight">
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-600">Geoagritech</p>
                <p className="text-lg font-semibold tracking-tight text-slate-900">Geospatial map</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={dashboardHref}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </Link>
            </div>
          </div>
        </header>
      )}

  <main className={`relative z-20 pb-16 ${showLandingExperience ? "" : "pt-8"}`}>
        {showLandingExperience && (
          <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="space-y-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Barangay intelligence
              </p>
              <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
                Barangay situational awareness
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-slate-600">
                {aboutDescription}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
                <button
                  type="button"
                  onClick={handleScrollToMap}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-white shadow-lg shadow-emerald-300/40 transition hover:bg-emerald-500"
                >
                  Explore barangay map
                  <ArrowRight className="h-4 w-4" />
                </button>
                {isAuthenticated && (
                  <Link
                    to={dashboardHref}
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/60 bg-white/90 px-5 py-2.5 text-emerald-700 shadow-sm transition hover:border-emerald-500 hover:text-emerald-800"
                  >
                    Open dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        <section ref={mapSectionRef} className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {statCards.map(({ id, label, value, icon, caption }) => {
                  const IconComponent = icon
                  return (
                    <article
                      key={id}
                      className="rounded-2xl border border-white/60 bg-white/75 p-5 shadow-sm shadow-emerald-900/5 backdrop-blur transition hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">{label}</p>
                          <p className="mt-3 text-2xl font-semibold text-slate-900">{mapIsLoading ? "…" : value}</p>
                        </div>
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                          <IconComponent className="h-5 w-5" />
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">{caption}</p>
                    </article>
                  )
                })}
              </div>

              <div className="rounded-3xl border border-emerald-100/70 bg-white/90 shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-900">Season &amp; year filters</h3>
                    <p className="text-[11px] text-slate-500">
                      {periodLabel === "Latest available"
                        ? "Showing latest approved data across all barangays."
                        : `Showing ${periodLabel}.`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-700 shadow-sm focus:border-emerald-400 focus:outline-none"
                      value={topCropsFilters.year}
                      onChange={(e) => setTopCropsFilters((prev) => ({ ...prev, year: Number(e.target.value) }))}
                    >
                      {YEAR_RANGE.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-700 shadow-sm focus:border-emerald-400 focus:outline-none"
                      value={topCropsFilters.season}
                      onChange={(e) => setTopCropsFilters((prev) => ({ ...prev, season: e.target.value, month: "" }))}
                    >
                      {SEASON_FILTERS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {selectedBarangayInfo && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {selectedBarangayInfo.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative">
                  {!isClient ? (
                    <div className="flex h-[460px] items-center justify-center text-sm text-slate-500">Initializing…</div>
                  ) : mapIsLoading ? (
                    <div className="flex h-[460px] items-center justify-center text-sm text-slate-500">Loading map…</div>
                  ) : !choroplethData ? (
                    <div className="flex h-[460px] items-center justify-center text-sm text-slate-500">No map data.</div>
                  ) : (
                    <MapContainer
                      key="geospatial-map"
                      center={DEFAULT_CENTER}
                      zoom={13}
                      scrollWheelZoom
                      doubleClickZoom={false}
                      className="z-0 h-[460px] w-full"
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <GeoJSON key="geojson-layer" data={choroplethData} style={geoJsonStyle} onEachFeature={handleEachFeature} ref={geoJsonLayerRef} />
                    </MapContainer>
                  )}
                  {choroplethData && (
                    <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-md">
                      <p className="mb-1 font-semibold text-slate-900">Yield (MT/ha)</p>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">{yieldRangeLabels.min}</span>
                        <div className="h-2 w-20 rounded-full bg-gradient-to-r from-emerald-200 to-emerald-700" />
                        <span className="text-slate-600">{yieldRangeLabels.max}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <aside className="space-y-6">
              <section className="rounded-3xl border border-white/60 bg-white/85 p-5 shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Recommended crop</h3>
                    <p className="text-xs text-slate-500">Latest guidance for the selected barangay.</p>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <Sparkles className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-4 text-sm">
                  {!selectedBarangayInfo ? (
                    <p className="text-xs text-slate-500">Select a barangay to preview its recommended crop.</p>
                  ) : bestCropLoading ? (
                    <p className="text-xs text-emerald-700">Generating recommendation…</p>
                  ) : bestCropError ? (
                    <p className={`text-xs ${isNeutralRecommendationMessage ? "text-slate-500" : "text-rose-600"}`}>
                      {bestCropError}
                    </p>
                  ) : !bestCrop ? (
                    <p className="text-xs text-slate-500">Recommendation will appear once model data is available.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-600">Recommended crop</p>
                        <p className="text-2xl font-semibold text-slate-900">{bestCrop.cropName}</p>
                      </div>
                      <dl className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Season</dt>
                          <dd className="text-sm font-semibold text-slate-900">{bestCropSubtitle ? bestCropSubtitle.split(" • ")[0] : formatSeasonTitle(bestCrop.season) ?? "—"}</dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Year</dt>
                          <dd className="text-sm font-semibold text-slate-900">{Number.isFinite(bestCrop.year) ? bestCrop.year : "—"}</dd>
                        </div>
                      </dl>
                      <div className="text-[11px] text-slate-400">
                        {bestCropMeta?.cached ? <p>Showing the latest saved result.</p> : <p>Updated with the latest submission.</p>}
                        {bestCrop?.fallback ? <p>Using cached data until the service refreshes.</p> : null}
                        {bestCropRefreshedLabel ? <p>Last updated {bestCropRefreshedLabel}.</p> : null}
                      </div>
                    </div>
                  )}
                </div>
              </section>
              <section className="rounded-3xl border border-white/60 bg-white/85 p-5 shadow-sm backdrop-blur">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Top crops</h3>
                    <p className="text-xs text-slate-500">Quick leaderboard filtered by season or month</p>
                    <p className="text-[11px] text-slate-400">
                      {periodLabel === "Latest available" ? "Showing latest approved yields" : `Showing ${periodLabel}`}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    Filters are shared with the map controls above.
                  </div>
                </div>

                {topCropsLoading ? (
                  <div className="flex justify-center py-6">
                    <span className="text-xs text-emerald-600">Syncing crops…</span>
                  </div>
                ) : topCropsError ? (
                  <p className="text-xs text-slate-500">{topCropsError}</p>
                ) : topCrops.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No approved yield entries match these filters yet. Encourage barangay field teams to submit their latest reports.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {topCrops.map((crop, idx) => (
                      <li
                        key={crop.cropId ?? crop.cropName}
                        className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-white/90 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">{crop.cropName}</p>
                            <p className="text-[11px] text-slate-500">{crop.totalYield.toFixed(1)} MT</p>
                          </div>
                        </div>
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-3xl border border-white/60 bg-white/85 p-5 shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Crop Prices</h3>
                    <p className="text-xs text-slate-500">Latest price submissions from barangay monitors</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedBarangayInfo?.name && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                        {selectedBarangayInfo.name}
                      </span>
                    )}
                    <select
                      className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-700 shadow-sm focus:border-emerald-400 focus:outline-none"
                      value={cropPriceFilters.crop}
                      onChange={(e) => setCropPriceFilters((prev) => ({ ...prev, crop: e.target.value }))}
                    >
                      <option value="all">All crops</option>
                      {cropFilterOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-700 shadow-sm focus:border-emerald-400 focus:outline-none"
                      value={cropPriceFilters.month}
                      onChange={(e) => setCropPriceFilters((prev) => ({ ...prev, month: e.target.value }))}
                    >
                      {MONTH_OPTIONS.map((option) => (
                        <option key={`price-month-${option.label}`} value={option.value === "" ? "" : String(option.value)}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  {!selectedBarangayInfo ? (
                    <p className="text-xs text-slate-500">Select a barangay to view market prices.</p>
                  ) : cropPricesLoading ? (
                    <p className="text-xs text-emerald-700">Loading…</p>
                  ) : cropPricesError ? (
                    <p className="text-xs text-rose-600">{cropPricesError}</p>
                  ) : cropPrices.length === 0 ? (
                    <p className="text-xs text-slate-500">No market price submissions are on file for this barangay yet.</p>
                  ) : cropPriceChartData.length === 0 ? (
                    <p className="text-xs text-slate-500">No price records match these filters yet. Try selecting a different crop or month.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={cropPriceChartData} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} tickLine={false} axisLine={{ stroke: "#cbd5f5" }} />
                            <YAxis
                              width={78}
                              tickFormatter={(value) => formatPrice(value)}
                              tick={{ fontSize: 11, fill: "#475569" }}
                              tickLine={false}
                              axisLine={{ stroke: "#cbd5f5" }}
                            />
                            <Tooltip cursor={{ stroke: "#34d399", strokeWidth: 1, strokeDasharray: "4 4" }} content={renderCropPriceTooltip} />
                            <Line type="monotone" dataKey="price" stroke="#047857" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      {latestCropPrice ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-[11px] text-emerald-700">
                          <span className="font-semibold text-emerald-900">{formatPrice(latestCropPrice.price)}</span>
                          <span className="text-emerald-700/80">
                            {latestCropPrice.cropName}
                            {latestCropPriceLabel ? ` • ${latestCropPriceLabel}` : ""}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </main>
    </div>
  )
}
