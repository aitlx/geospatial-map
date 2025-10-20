import { topCropsService } from "../services/topCropsService.js"
import { handleResponse } from "../utils/handleResponse.js"

export const listTopCrops = async (req, res, next) => {
  try {
    const { barangayId, year, season, limit, month, months } = req.query
    const crops = await topCropsService.getTopCrops({ barangayId, year, season, month, months, limit })
    return handleResponse(res, 200, "Top crops fetched successfully.", { results: crops })
  } catch (error) {
    return next(error)
  }
}
