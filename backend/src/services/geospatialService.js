import pool from "../config/db.js"

const sanitizeInteger = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const sanitizeSeason = (value) => {
  if (!value) return null
  const trimmed = value.toString().trim().toLowerCase()
  if (!trimmed) return null
  if (["wet", "dry"].includes(trimmed)) return trimmed
  return null
}

const sanitizeLimit = (value, fallback = 12, max = 24) => {
  const parsed = sanitizeInteger(value, fallback)
  if (parsed === null || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

const normalizeYieldRow = (row) => ({
  barangayId: row?.barangay_id ?? null,
  barangayName: row?.barangay_name ?? null,
  year: sanitizeInteger(row?.year),
  month: sanitizeInteger(row?.month),
  season: row?.season ? row.season.toString().trim().toLowerCase() : null,
  totalYield: row?.total_yield !== undefined && row?.total_yield !== null ? Number(row.total_yield) : null,
  totalArea: row?.total_area_planted_ha !== undefined && row?.total_area_planted_ha !== null ? Number(row.total_area_planted_ha) : null,
  yieldPerHectare:
    row?.yield_per_hectare !== undefined && row?.yield_per_hectare !== null ? Number(row.yield_per_hectare) : null,
  updatedAt: row?.data_recorded ?? row?.date_recorded ?? row?.recorded_at ?? row?.updated_at ?? row?.updatedat ?? null,
})

const normalizePriceRow = (row) => ({
  barangayId: row?.barangay_id ?? null,
  year: sanitizeInteger(row?.year),
  month: sanitizeInteger(row?.month),
  season: row?.season ? row.season.toString().trim().toLowerCase() : null,
  averagePrice: row?.average_price !== undefined && row?.average_price !== null ? Number(row.average_price) : null,
  sampleSize: row?.sample_size !== undefined && row?.sample_size !== null ? Number(row.sample_size) : 0,
})

const pickMatchingPeriod = (rows, { year, month, season }) => {
  if (!Array.isArray(rows) || rows.length === 0) return null

  const normalizedSeason = sanitizeSeason(season)
  const normalizedYear = sanitizeInteger(year)
  const normalizedMonth = sanitizeInteger(month)

  const matches = rows.filter((entry) => {
    if (!entry) return false
    const sameYear = normalizedYear ? entry.year === normalizedYear : true
    const sameMonth = normalizedMonth ? entry.month === normalizedMonth : true
    const sameSeason = normalizedSeason ? entry.season === normalizedSeason : true
    return sameYear && sameMonth && sameSeason
  })

  if (matches.length > 0) return matches[0]

  if (normalizedSeason) {
    const seasonalMatch = rows.find((entry) => entry?.season === normalizedSeason && (!normalizedYear || entry.year === normalizedYear))
    if (seasonalMatch) return seasonalMatch
  }

  if (normalizedYear) {
    const yearlyMatch = rows.find((entry) => entry?.year === normalizedYear)
    if (yearlyMatch) return yearlyMatch
  }

  return rows[0]
}

const SNAPSHOT_LOOKBACK = 24

const fetchBarangayYieldSnapshots = async ({ year = null, season = null, month = null } = {}) => {
  const result = await pool.query(
    `
      WITH ranked_yields AS (
        SELECT
          by.yield_id,
          by.barangay_id,
          by.year,
          by.month,
          by.season,
          by.total_yield,
          by.total_area_planted_ha,
          by.yield_per_hectare,
          COALESCE(by.data_recorded) AS data_recorded,
          ROW_NUMBER() OVER (
            PARTITION BY by.barangay_id
            ORDER BY by.year DESC,
                     by.month DESC,
                     COALESCE(by.data_recorded, '1970-01-01'::timestamp) DESC,
                     by.yield_id DESC
          ) AS row_rank
        FROM barangay_yields AS by
        WHERE LOWER(COALESCE(by.status::text, '')) = 'approved'
      )
      SELECT
        ry.barangay_id,
        b.adm3_en AS barangay_name,
        ry.year,
        ry.month,
        ry.season,
        ry.total_yield,
        ry.total_area_planted_ha,
        ry.yield_per_hectare,
        ry.data_recorded
      FROM ranked_yields AS ry
      JOIN barangays AS b ON b.barangay_id = ry.barangay_id
      WHERE ry.row_rank <= $1
      ORDER BY ry.barangay_id,
               ry.year DESC,
               ry.month DESC,
               COALESCE(ry.data_recorded, '1970-01-01'::timestamp) DESC
    `,
    [SNAPSHOT_LOOKBACK]
  )

  const requestedPeriod = {
    year: sanitizeInteger(year),
    season: sanitizeSeason(season),
    month: sanitizeInteger(month),
  }

  const grouped = new Map()
  result.rows.forEach((row) => {
    const normalized = normalizeYieldRow(row)
    const barangayId = normalized.barangayId
    if (!barangayId) return

    if (!grouped.has(barangayId)) {
      grouped.set(barangayId, [])
    }
    grouped.get(barangayId).push(normalized)
  })

  const snapshots = []
  grouped.forEach((entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return
    const match = pickMatchingPeriod(entries, requestedPeriod)
    if (match) {
      snapshots.push(match)
    } else {
      snapshots.push(entries[0])
    }
  })

  return snapshots
}

const fetchBarangayYieldHistory = async ({ barangayId, limit = 12 }) => {
  const normalizedBarangayId = sanitizeInteger(barangayId)
  if (!normalizedBarangayId) return []

  const historyResult = await pool.query(
    `
      SELECT
        by.barangay_id,
        b.adm3_en AS barangay_name,
        by.year,
        by.month,
        by.season,
        by.total_yield,
        by.total_area_planted_ha,
        by.yield_per_hectare,
        COALESCE(by.data_recorded) AS data_recorded
      FROM barangay_yields AS by
      JOIN barangays AS b ON b.barangay_id = by.barangay_id
      WHERE by.barangay_id = $1
        AND LOWER(COALESCE(by.status::text, '')) = 'approved'
      ORDER BY by.year DESC,
               by.month DESC,
               COALESCE(by.data_recorded, '1970-01-01'::timestamp) DESC,
               by.yield_id DESC
      LIMIT $2
    `,
    [normalizedBarangayId, limit]
  )

  return historyResult.rows.map(normalizeYieldRow)
}

const fetchBarangayPriceHistory = async ({ barangayId, limit = 12 }) => {
  const normalizedBarangayId = sanitizeInteger(barangayId)
  if (!normalizedBarangayId) return []

  const priceResult = await pool.query(
    `
      SELECT
        bcp.barangay_id,
        bcp.year,
        bcp.month,
        bcp.season,
        AVG(bcp.price_per_kg) AS average_price,
        COUNT(*) AS sample_size
      FROM barangay_crop_prices bcp
      WHERE bcp.barangay_id = $1
        AND LOWER(COALESCE(bcp.status::text, '')) = 'approved'
      GROUP BY bcp.barangay_id, bcp.year, bcp.month, bcp.season
      ORDER BY bcp.year DESC, bcp.month DESC
      LIMIT $2
    `,
    [normalizedBarangayId, limit]
  )

  return priceResult.rows.map(normalizePriceRow)
}

const fetchBarangayMetrics = async ({ barangayId, limit = 12, year = null, season = null, month = null }) => {
  const normalizedBarangayId = sanitizeInteger(barangayId)
  if (!normalizedBarangayId) {
    return {
      barangayId: null,
      barangayName: null,
      current: null,
      latest: null,
      yieldHistory: [],
      priceHistory: [],
      requestedPeriod: { year: null, season: null, month: null },
    }
  }

  const historyLimit = sanitizeLimit(limit)
  const [history, priceHistory] = await Promise.all([
    fetchBarangayYieldHistory({ barangayId: normalizedBarangayId, limit: historyLimit }),
    fetchBarangayPriceHistory({ barangayId: normalizedBarangayId, limit: historyLimit }),
  ])

  const requestedPeriod = {
    year: sanitizeInteger(year),
    season: sanitizeSeason(season),
    month: sanitizeInteger(month),
  }

  const currentYield = pickMatchingPeriod(history, requestedPeriod)
  const currentPrice = pickMatchingPeriod(priceHistory, requestedPeriod)

  const latestYield = history.length ? history[0] : null
  const latestPrice = priceHistory.length ? priceHistory[0] : null

  const barangayName = latestYield?.barangayName ?? history.find((entry) => entry?.barangayName)?.barangayName ?? null

  return {
    barangayId: normalizedBarangayId,
    barangayName,
    requestedPeriod,
    current: currentYield,
    currentPrice,
    latest: latestYield,
    latestPrice,
    yieldHistory: history,
    priceHistory,
  }
}

export const geospatialService = {
  fetchBarangayYieldSnapshots,
  fetchBarangayMetrics,
}
