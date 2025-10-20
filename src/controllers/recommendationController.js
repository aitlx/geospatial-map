import { recommendationService } from "../services/recommendationService.js"
import { handleResponse } from "../utils/handleResponse.js"

const parseBoolean = (value) => {
  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.toLowerCase())
  }
  return Boolean(value)
}

export const listRecommendations = async (req, res, next) => {
  try {
    const { barangayId, season, year, limit, groupBy } = req.query
    const groupByCrop = groupBy === "crop" || parseBoolean(req.query.groupByCrop)

    const { rows, meta } = await recommendationService.fetchRecommendations({
      barangayId,
      season,
      year,
      limit,
      groupByCrop,
    })

    return handleResponse(res, 200, "Recommendations fetched successfully.", {
      results: rows,
      meta,
    })
  } catch (error) {
    return next(error)
  }
}

export const getBestRecommendation = async (req, res, next) => {
  try {
    const { barangayId } = req.params
    const { season, year, forceRefresh } = req.query

    if (!barangayId) {
      return handleResponse(res, 400, "barangayId path parameter is required.")
    }

    if (!season) {
      return handleResponse(res, 400, "Query parameter 'season' is required (wet or dry).")
    }

    if (!year) {
      return handleResponse(res, 400, "Query parameter 'year' is required.")
    }

    const { best, meta } = await recommendationService.fetchBestRecommendation({
      barangayId,
      season,
      year,
      forceRefresh: parseBoolean(forceRefresh),
    })

    if (!best) {
      return handleResponse(res, 404, "No recommendation available for this barangay and filters.")
    }

    return handleResponse(res, 200, "Best crop recommendation fetched successfully.", {
      result: best,
      meta,
    })
  } catch (error) {
    return next(error)
  }
}
