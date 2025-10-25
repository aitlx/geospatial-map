import barangayYieldService from "../services/barangayYieldService.js";
import { handleResponse } from "../utils/handleResponse.js";
import { logService } from "../services/logService.js";

const {
  addBarangayYieldService,
  fetchBarangayYieldsService,
  fetchBarangayYieldsByUserService,
  deleteBarangayYieldService,
  fetchBarangayYieldByIdService,
  updateBarangayYieldService
} = barangayYieldService;

// Add barangay yield record
export const addBarangayYield = async (req, res, next) => {
  const {
    barangay_id,
    crop_id,
    year,
    month,
    season,
    total_yield,
    total_area_planted_ha,
    yield_per_hectare
  } = req.body;

  const recordedByUserId = req.user?.id;

  if (
    !barangay_id ||
    !crop_id ||
    !year ||
    !month ||
    !season ||
    !total_yield ||
    !total_area_planted_ha ||
    !yield_per_hectare
  ) {
    return handleResponse(res, 400, false, "All fields are required");
  }

  const normalizedMonth = Number(month);
  if (!Number.isInteger(normalizedMonth) || normalizedMonth < 1 || normalizedMonth > 12) {
    return handleResponse(res, 400, false, "Month must be an integer between 1 and 12");
  }

  // Normalize and validate season (accept common casings). Keep canonical label for UI/logs
  const normalizedSeason = typeof season === 'string' ? season.trim() : null;
  let canonicalSeason = null;
  let dbSeason = null;
  if (normalizedSeason) {
    const lower = normalizedSeason.toLowerCase();
    if (lower === 'wet') { canonicalSeason = 'Wet'; dbSeason = 'wet'; }
    else if (lower === 'dry') { canonicalSeason = 'Dry'; dbSeason = 'dry'; }
  }
  if (!canonicalSeason) {
    return handleResponse(res, 400, false, "season must be either 'Wet' or 'Dry'");
  }

  try {

    const newYieldRecord = await addBarangayYieldService(
      barangay_id,
      crop_id,
      year,
      normalizedMonth,
      dbSeason,
      total_yield,
      total_area_planted_ha,
      yield_per_hectare,
      recordedByUserId
    );

    const metricsProvided = {
      totalYield: total_yield !== undefined && total_yield !== null,
      totalArea: total_area_planted_ha !== undefined && total_area_planted_ha !== null,
      yieldPerHectare: yield_per_hectare !== undefined && yield_per_hectare !== null,
    };

    await logService.add({
      userId: req.user.id,
      roleId: req.user.roleID,
      action: "ADD_YIELD",
      targetTable: "barangay_yields",
      targetId: newYieldRecord.yield_id,
      details: {
        summary: "Yield record created",
        period: { year, month: normalizedMonth, season: canonicalSeason },
        metricsProvided,
      },
    });

    return handleResponse(
      res,
      201,
      "Yield record added successfully (status: pending)",
      newYieldRecord
    );
  } catch (err) {
    console.error('addBarangayYield error:', err?.message || err);
    next(err);
  }
};

// Fetch all barangay yield records
export const fetchBarangayYields = async (req, res, next) => {
  try {
    const mineFlag = (req.query.mine || "").toString().toLowerCase();
    const showMine = ["true", "1", "yes", "me", "self"].includes(mineFlag);
    const statusFilterRaw = (req.query.status || "").toString().trim().toLowerCase();
    const statusFilter = statusFilterRaw && statusFilterRaw !== "all" ? statusFilterRaw : null;

    let yields;
    if (showMine && req.user?.id) {
      yields = await fetchBarangayYieldsByUserService(req.user.id, { status: statusFilter });
    } else {
      yields = await fetchBarangayYieldsService({ status: statusFilter });
    }

    return handleResponse(res, 200, "Barangay yields fetched successfully", yields);
  } catch (err) {
    next(err);
  }
};

export const fetchApprovedBarangayYieldsPublic = async (req, res, next) => {
  try {
    const yields = await fetchBarangayYieldsService({ status: "approved" });
    return handleResponse(res, 200, "Approved barangay yields fetched successfully", yields);
  } catch (err) {
    next(err);
  }
};


// Fetch barangay yield record by ID
export const fetchBarangayYieldById = async (req, res, next) => {
  try {
    const yieldRecord = await fetchBarangayYieldByIdService(req.params.id);

    if (!yieldRecord) {
      return handleResponse(res, 404, false, "Yield record not found");
    }

  return handleResponse(res, 200, "Barangay yield fetched successfully", yieldRecord);
  } catch (err) {
    next(err);
  }
};

// update barangay yield record
export const updateBarangayYield = async (req, res, next) => {
  const {
    barangay_id,
    crop_id,
    year,
    month,
    season,
    total_yield,
    total_area_planted_ha,
    yield_per_hectare
  } = req.body;

  try {
    if (
      !barangay_id &&
      !crop_id &&
      !year &&
      !month &&
      !season &&
      !total_yield &&
      !total_area_planted_ha &&
      !yield_per_hectare
    ) {
      return handleResponse(res, 400, false, "At least one field must be provided to update");
    }

    let normalizedMonth = month;
    if (month !== undefined) {
      const parsed = Number(month);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
        return handleResponse(res, 400, false, "Month must be an integer between 1 and 12");
      }
      normalizedMonth = parsed;
    }

    // normalize season for update if provided
    let canonicalSeasonUpdate = season;
    if (season !== undefined) {
      const sNorm = typeof season === 'string' ? season.trim().toLowerCase() : null;
      if (sNorm === 'wet') canonicalSeasonUpdate = 'Wet';
      else if (sNorm === 'dry') canonicalSeasonUpdate = 'Dry';
      else canonicalSeasonUpdate = null;
      if (season !== undefined && canonicalSeasonUpdate == null) {
        return handleResponse(res, 400, false, "season must be either 'Wet' or 'Dry'");
      }
    }

    const updatedYield = await updateBarangayYieldService(
      req.params.id,
      barangay_id,
      crop_id,
      year,
      normalizedMonth,
      canonicalSeasonUpdate,
      total_yield,
      total_area_planted_ha,
      yield_per_hectare
    );

    if (!updatedYield) {
      return handleResponse(res, 404, false, "Yield record not found");
    }

    await logService.add({
      userId: req.user.id,
      roleId: req.user.roleID,
      action: "UPDATE_YIELD",
      targetTable: "barangay_yields",
      targetId: updatedYield.yield_id,
      details: {
        summary: "Yield record updated",
        updatedFields: Object.keys(req.body ?? {}),
      },
    });

    return handleResponse(res, 200, true, "Yield record updated successfully", updatedYield);
  } catch (err) {
    next(err);
  }
};

// Delete barangay yield record
export const deleteBarangayYield = async (req, res, next) => {
  try {
    const yieldRecord = await deleteBarangayYieldService(req.params.id);

    if (!yieldRecord) {
      return handleResponse(res, 404, false, "Yield record not found");
    }

    const metricsPresent = {
      totalYield: yieldRecord.total_yield !== undefined && yieldRecord.total_yield !== null,
      totalArea: yieldRecord.total_area_planted_ha !== undefined && yieldRecord.total_area_planted_ha !== null,
      yieldPerHectare: yieldRecord.yield_per_hectare !== undefined && yieldRecord.yield_per_hectare !== null,
    };

    await logService.add({
      userId: req.user.id,
      roleId: req.user.roleID,
      action: "DELETE_YIELD",
      targetTable: "barangay_yields",
      targetId: yieldRecord.yield_id,
      details: {
        summary: "Yield record deleted",
        period: { year: yieldRecord.year, month: yieldRecord.month, season: yieldRecord.season },
        metricsPresent,
      },
    });

    return handleResponse(res, 200, true, "Yield record deleted successfully", yieldRecord);
  } catch (err) {
    next(err);
  }
};
