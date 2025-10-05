import pool from "../config/db.js"

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 50
const ML_API_URL = process.env.RECOMMENDATION_API_URL || "http://127.0.0.1:5001/recommend"
const ML_API_TIMEOUT_MS = Number.parseInt(process.env.RECOMMENDATION_API_TIMEOUT ?? "5000", 10)

const toInteger = (value, fallback = null) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const normalizeSeason = (season) => {
  if (!season) return null
  const normalized = season.toString().trim().toLowerCase()
  return normalized === "wet" || normalized === "dry" ? normalized : null
}

const sanitizeLimit = (input) => {
  const parsed = Number.parseInt(input, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT
  }
  return Math.min(parsed, MAX_LIMIT)
}

const buildFilters = ({ barangayId, season, year }) => {
  const conditions = []
  const values = []

  if (barangayId) {
    values.push(barangayId)
    conditions.push(`r.barangay_id = $${values.length}`)
  }

  if (season) {
    values.push(season)
    conditions.push(`LOWER(r.season) = LOWER($${values.length})`)
  }

  if (year) {
    values.push(year)
    conditions.push(`r.year = $${values.length}`)
  }

  return { conditions, values }
}

const findCachedBestRecommendation = async ({ barangayId, season, year }) => {
  const primaryQuery = `
    SELECT
      r.id,
      r.barangay_id,
      r.season,
      r.year,
      r.crop_id,
      r.avg_yield,
      r.avg_price,
      r.score,
      r.created_at,
      r.updated_at,
      c.crop_name,
      b.adm3_en AS barangay_name
    FROM recommendations r
    LEFT JOIN crops c ON c.crop_id = r.crop_id
    LEFT JOIN barangays b ON b.barangay_id = r.barangay_id
    WHERE r.barangay_id = $1
      AND LOWER(r.season) = LOWER($2)
      AND r.year = $3
    ORDER BY r.score DESC NULLS LAST, r.avg_yield DESC NULLS LAST
    LIMIT 1
  `

  const { rows: preciseRows } = await pool.query(primaryQuery, [barangayId, season, year])
  if (preciseRows.length > 0) {
    return { record: preciseRows[0], fallback: false }
  }

  const fallbackQuery = `
    SELECT
      r.id,
      r.barangay_id,
      r.season,
      r.year,
      r.crop_id,
      r.avg_yield,
      r.avg_price,
      r.score,
      r.created_at,
      r.updated_at,
      c.crop_name,
      b.adm3_en AS barangay_name
    FROM recommendations r
    LEFT JOIN crops c ON c.crop_id = r.crop_id
    LEFT JOIN barangays b ON b.barangay_id = r.barangay_id
    WHERE r.barangay_id = $1
      AND LOWER(r.season) = LOWER($2)
    ORDER BY r.year DESC, r.score DESC NULLS LAST, r.avg_yield DESC NULLS LAST
    LIMIT 1
  `

  const { rows: fallbackRows } = await pool.query(fallbackQuery, [barangayId, season])
  if (fallbackRows.length > 0) {
    return { record: fallbackRows[0], fallback: true }
  }

  return { record: null, fallback: false }
}

const persistRecommendationBatch = async ({ barangayId, season, year, predictions }) => {
  if (!Array.isArray(predictions) || predictions.length === 0) return

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query(
      "DELETE FROM recommendations WHERE barangay_id = $1 AND LOWER(season) = LOWER($2) AND year = $3",
      [barangayId, season, year]
    )

    const insertSql = `
      INSERT INTO recommendations (
        barangay_id,
        season,
        year,
        crop_id,
        avg_yield,
        avg_price,
        score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `

    for (const prediction of predictions) {
      const values = [
        barangayId,
        season,
        year,
        toInteger(prediction.crop_id ?? prediction.cropId, null),
        prediction.avg_yield ?? prediction.avgYield ?? null,
        prediction.avg_price ?? prediction.avgPrice ?? null,
        prediction.score ?? (typeof prediction.probability === "number" ? prediction.probability * 100 : null),
      ]

      await client.query(insertSql, values)
    }

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Failed to persist recommendation batch", error)
  } finally {
    client.release()
  }
}

const callRecommendationApi = async ({ barangayId, season, year, topK = 3 }) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ML_API_TIMEOUT_MS)

  try {
    const response = await fetch(ML_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barangay_id: barangayId,
        season,
        year,
        top_k: topK,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText)
      throw new Error(`Recommendation API responded with ${response.status}: ${message}`)
    }

    return response.json()
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Recommendation API request timed out after ${ML_API_TIMEOUT_MS}ms`)
    }

    const detail = error?.message ?? "unknown error"
    throw new Error(`Failed to reach recommendation API at ${ML_API_URL}: ${detail}`)
  } finally {
    clearTimeout(timeout)
  }
}

const fetchGroupedByCrop = async ({ barangayId, season, year, limit }) => {
  const { conditions, values } = buildFilters({ barangayId, season, year })

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
  values.push(limit)

  const query = `
    SELECT
      c.crop_id AS crop_id,
      c.crop_name AS crop_name,
      AVG(r.score) AS score,
      AVG(r.avg_yield) AS avg_yield,
      AVG(r.avg_price) AS avg_price,
      COUNT(*) AS recommendation_count,
      MIN(r.year) AS first_year,
      MAX(r.year) AS latest_year
    FROM recommendations r
    JOIN crops c ON c.crop_id = r.crop_id
    ${whereClause}
    GROUP BY c.crop_id, c.crop_name
    ORDER BY score DESC NULLS LAST, avg_yield DESC NULLS LAST
    LIMIT $${values.length}
  `

  const result = await pool.query(query, values)
  return result.rows
}

const fetchRawRecommendations = async ({ barangayId, season, year, limit }) => {
  const { conditions, values } = buildFilters({ barangayId, season, year })
  values.push(limit)

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const query = `
    SELECT
      r.id,
      r.barangay_id,
      r.season,
      r.year,
      r.crop_id,
      r.avg_yield,
      r.avg_price,
      r.score,
      r.created_at,
      r.updated_at,
      c.crop_name,
      b.adm3_en AS barangay_name
    FROM recommendations r
    JOIN crops c ON c.crop_id = r.crop_id
    LEFT JOIN barangays b ON b.barangay_id = r.barangay_id
    ${whereClause}
    ORDER BY r.score DESC NULLS LAST, r.avg_yield DESC NULLS LAST
    LIMIT $${values.length}
  `

  const result = await pool.query(query, values)
  return result.rows
}

const fetchRecommendations = async ({ barangayId = null, season = null, year = null, limit, groupByCrop = false }) => {
  const sanitizedLimit = sanitizeLimit(limit)

  const filters = {
    barangayId: barangayId ? Number.parseInt(barangayId, 10) || null : null,
    season: season ? season.toString().trim().toLowerCase() : null,
    year: year ? Number.parseInt(year, 10) || null : null,
    limit: sanitizedLimit,
  }

  const rows = groupByCrop ? await fetchGroupedByCrop(filters) : await fetchRawRecommendations(filters)

  const normalizedRows = rows.map((row) => ({
    ...row,
    fallback: false,
  }))

  return {
    rows: normalizedRows,
    meta: {
  fallback: false,
      filters: {
        barangayId: filters.barangayId,
        season: filters.season,
        year: filters.year,
        limit: filters.limit,
        groupByCrop,
      },
    },
  }
}

const mapCachedBest = (record, fallback, requestedYear) => {
  if (!record) return null

  const scoreNumber = record.score !== null && record.score !== undefined ? Number(record.score) : null
  return {
    barangayId: record.barangay_id,
    barangayName: record.barangay_name,
    cropId: record.crop_id,
    cropName: record.crop_name,
    season: record.season,
    year: record.year,
    avgYield: record.avg_yield !== null && record.avg_yield !== undefined ? Number(record.avg_yield) : null,
    avgPrice: record.avg_price !== null && record.avg_price !== undefined ? Number(record.avg_price) : null,
    probability: scoreNumber !== null ? scoreNumber / 100 : null,
    score: scoreNumber,
    source: "cache",
    fallback,
    requestedYear,
    refreshedAt: record.updated_at || record.created_at || null,
  }
}

const sanitizePrediction = (prediction) => {
  if (!prediction) return null
  const probability =
    typeof prediction.probability === "number"
      ? prediction.probability
      : typeof prediction.score === "number"
      ? prediction.score / 100
      : null

  return {
    barangayId: prediction.barangay_id ?? prediction.barangayId ?? null,
    barangayName: prediction.barangay_name ?? prediction.barangayName ?? null,
    cropId: toInteger(prediction.crop_id ?? prediction.cropId, null),
    cropName: prediction.crop_name ?? prediction.cropName ?? null,
    season: prediction.season ?? null,
    year: prediction.year ?? null,
    avgYield: typeof prediction.avg_yield === "number" ? prediction.avg_yield : prediction.avgYield ?? null,
    avgPrice: typeof prediction.avg_price === "number" ? prediction.avg_price : prediction.avgPrice ?? null,
    expectedRevenue:
      typeof prediction.expected_revenue === "number"
        ? prediction.expected_revenue
        : prediction.expectedRevenue ?? null,
    probability,
    score: typeof prediction.score === "number" ? prediction.score : probability !== null ? probability * 100 : null,
    rank: toInteger(prediction.rank, null),
  }
}

const fetchBestRecommendation = async ({ barangayId, season, year, forceRefresh = false }) => {
  const normalizedBarangayId = toInteger(barangayId, null)
  if (!normalizedBarangayId) {
    throw new Error("A valid barangayId is required.")
  }

  const normalizedSeason = normalizeSeason(season)
  if (!normalizedSeason) {
    throw new Error("season must be either 'wet' or 'dry'.")
  }

  const normalizedYear = toInteger(year, null)
  if (!normalizedYear) {
    throw new Error("A valid year is required.")
  }

  const cachedLookup = await findCachedBestRecommendation({
    barangayId: normalizedBarangayId,
    season: normalizedSeason,
    year: normalizedYear,
  })

  const cachedRecord = cachedLookup.record
  const cachedFallback = cachedLookup.fallback

  if (!forceRefresh && cachedRecord && Number(cachedRecord.year) === normalizedYear) {
    return {
      best: mapCachedBest(cachedRecord, cachedFallback, normalizedYear),
      meta: {
        cached: true,
        fallback: cachedFallback,
        context: {
          barangayId: normalizedBarangayId,
          season: normalizedSeason,
          year: normalizedYear,
        },
      },
    }
  }

  let apiResponse
  try {
    apiResponse = await callRecommendationApi({
      barangayId: normalizedBarangayId,
      season: normalizedSeason,
      year: normalizedYear,
    })
  } catch (error) {
    console.error("Recommendation API call failed", error)

    if (cachedRecord && Number(cachedRecord.year) === normalizedYear) {
      return {
        best: mapCachedBest(cachedRecord, cachedFallback, normalizedYear),
        meta: {
          cached: true,
          fallback: cachedFallback,
          serviceUnavailable: true,
          context: {
            barangayId: normalizedBarangayId,
            season: normalizedSeason,
            year: normalizedYear,
          },
          error: error?.message ?? "Recommendation service unavailable",
        },
      }
    }

    const annotated = new Error(
      "Recommendation service is offline and no cached recommendation is currently available."
    )
    annotated.statusCode = 503
    annotated.expose = true
    annotated.details = {
      code: "RECOMMENDATION_SERVICE_UNAVAILABLE",
      serviceUrl: ML_API_URL,
      suggestion:
        "Ensure the ML recommendation service is running (e.g., activate the ml virtual environment and start recommendation_api.py), then try again.",
      originalError: error?.message ?? "Unknown error",
    }
    throw annotated
  }

  const predictionsRaw = Array.isArray(apiResponse?.predictions) ? apiResponse.predictions : []
  if (predictionsRaw.length === 0) {
    throw new Error("Recommendation service returned no predictions.")
  }

  const sanitizedPredictions = predictionsRaw
    .map((prediction) => sanitizePrediction(prediction))
    .filter((entry) => entry && entry.cropId !== null)

  const bestPrediction = sanitizedPredictions[0]
  if (!bestPrediction) {
    throw new Error("Unable to determine a best crop from the recommendation service response.")
  }

  await persistRecommendationBatch({
    barangayId: normalizedBarangayId,
    season: normalizedSeason,
    year: normalizedYear,
    predictions: sanitizedPredictions,
  })

  const best = {
    ...bestPrediction,
    barangayId: normalizedBarangayId,
    season: normalizedSeason,
    year: normalizedYear,
    source: "ml-api",
    fallback: false,
    requestedYear: normalizedYear,
    refreshedAt: new Date().toISOString(),
    model: apiResponse?.model ?? null,
  }

  return {
    best,
    meta: {
      cached: false,
      fallback: false,
      context: {
        barangayId: normalizedBarangayId,
        season: normalizedSeason,
        year: normalizedYear,
        totalPredictions: sanitizedPredictions.length,
      },
      model: apiResponse?.model ?? null,
      metadata: apiResponse?.metadata ?? null,
    },
  }
}

export const recommendationService = {
  fetchRecommendations,
  fetchBestRecommendation,
}
