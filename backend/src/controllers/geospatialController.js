import { geospatialService } from "../services/geospatialService.js"
import { handleResponse } from "../utils/handleResponse.js"

export const getBarangayYieldSnapshots = async (req, res, next) => {
  try {
    const { year = null, season = null, month = null } = req.query
    const snapshots = await geospatialService.fetchBarangayYieldSnapshots({ year, season, month })

    const totals = snapshots.reduce(
      (accumulator, snapshot) => {
        const totalYield = Number.isFinite(snapshot?.totalYield) ? snapshot.totalYield : 0
        const totalArea = Number.isFinite(snapshot?.totalArea) ? snapshot.totalArea : 0
        const yieldPerHectare = Number.isFinite(snapshot?.yieldPerHectare) ? snapshot.yieldPerHectare : null

        accumulator.totalYield += totalYield
        accumulator.totalArea += totalArea
        if (yieldPerHectare !== null) {
          accumulator.yieldPerHectareValues.push(yieldPerHectare)
        }
        if (snapshot?.barangayId) {
          accumulator.barangayIds.add(snapshot.barangayId)
        }
        return accumulator
      },
      {
        totalYield: 0,
        totalArea: 0,
        yieldPerHectareValues: [],
        barangayIds: new Set(),
      }
    )

    const averageYieldPerHectare = totals.yieldPerHectareValues.length
      ? totals.yieldPerHectareValues.reduce((sum, value) => sum + value, 0) / totals.yieldPerHectareValues.length
      : null

    return handleResponse(res, 200, "Barangay yield snapshots fetched successfully.", {
      snapshots,
      summary: {
        barangaysWithApprovedYields: totals.barangayIds.size,
        totalApprovedYield: totals.totalYield,
        totalApprovedArea: totals.totalArea,
        averageYieldPerHectare,
      },
    })
  } catch (error) {
    return next(error)
  }
}

export const getBarangayMetrics = async (req, res, next) => {
  try {
    const { barangayId } = req.params
    const { year = null, season = null, month = null, limit = null } = req.query

    const metrics = await geospatialService.fetchBarangayMetrics({
      barangayId,
      year,
      season,
      month,
      limit,
    })

    return handleResponse(res, 200, "Barangay metrics fetched successfully.", metrics)
  } catch (error) {
    return next(error)
  }
}
