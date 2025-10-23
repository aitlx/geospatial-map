import pool from "../config/db.js"
import { seasonAggregationService } from "./seasonAggregationService.js"

const sanitizeInteger = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const sanitizeMonthList = (input) => {
  if (input === null || input === undefined) return []

  const asArray = Array.isArray(input)
    ? input
    : typeof input === "string"
    ? input.split(",")
    : [input]

  const unique = new Set()

  asArray.forEach((candidate) => {
    const parsed = sanitizeInteger(candidate)
    if (parsed !== null && parsed >= 1 && parsed <= 12) {
      unique.add(parsed)
    }
  })

  return Array.from(unique).sort((a, b) => a - b)
}

const sanitizeLimit = (value, fallback = 5) => {
  const parsed = sanitizeInteger(value, fallback)
  if (parsed === null || parsed <= 0) return fallback
  return Math.min(parsed, 10)
}

export const topCropsService = {
  async getTopCrops({ barangayId, year, season, month, months, limit = 5 }) {
    const conditions = ["LOWER(COALESCE(by.status::text, '')) = 'approved'"]
    const values = []
    // Accept optional crop filters (cropId or crop name)
    let cropIdFilter = null
    let cropNameFilter = null
    if (arguments[0] && (arguments[0].cropId || arguments[0].crop)) {
      cropIdFilter = arguments[0].cropId ?? null
      cropNameFilter = arguments[0].crop ?? null
    }

    const parsedBarangayId = sanitizeInteger(barangayId)
    if (parsedBarangayId !== null) {
      values.push(parsedBarangayId)
      conditions.push(`by.barangay_id = $${values.length}`)
    }

    // crop id filter
    const parsedCropId = sanitizeInteger(cropIdFilter)
    if (parsedCropId !== null) {
      values.push(parsedCropId)
      conditions.push(`by.crop_id = $${values.length}`)
    } else if (cropNameFilter && typeof cropNameFilter === 'string') {
      // filter by crop name (case-insensitive match)
      values.push(cropNameFilter.trim().toLowerCase())
      conditions.push(`LOWER(c.crop_name) = LOWER($${values.length})`)
    }

    const parsedYear = sanitizeInteger(year)
    if (parsedYear !== null) {
      values.push(parsedYear)
      conditions.push(`by.year = $${values.length}`)
    }

    let seasonValue = typeof season === "string" ? season.trim().toLowerCase() : null

    const monthFilters = sanitizeMonthList(month ?? months)
    if (!seasonValue && monthFilters.length) {
      const derivedSeasons = seasonAggregationService.deriveSeasonsFromMonths(monthFilters)
      if (derivedSeasons.length === 1) {
        ;[seasonValue] = derivedSeasons
      }
    }

    if (seasonValue && seasonValue !== "all") {
      values.push(seasonValue)
      conditions.push(`LOWER(by.season) = LOWER($${values.length})`)
    }

    if (monthFilters.length) {
      values.push(monthFilters)
      conditions.push(`by.month = ANY($${values.length})`)
    }

    const sanitizedLimit = sanitizeLimit(limit)
    values.push(sanitizedLimit)

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

    const query = `
      SELECT
        c.crop_id,
        c.crop_name,
        COALESCE(SUM(by.total_yield), 0) AS total_yield,
        COALESCE(SUM(by.total_area_planted_ha), 0) AS total_area,
        AVG(NULLIF(by.yield_per_hectare, 0)) AS average_yield_per_hectare,
        COUNT(*) AS report_count
      FROM barangay_yields by
      JOIN crops c ON c.crop_id = by.crop_id
      ${whereClause}
      GROUP BY c.crop_id, c.crop_name
      ORDER BY total_yield DESC NULLS LAST, average_yield_per_hectare DESC NULLS LAST
      LIMIT $${values.length}
    `

    const result = await pool.query(query, values)
    return result.rows
  },
}
