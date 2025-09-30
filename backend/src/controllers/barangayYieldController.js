import barangayYieldService from "../services/barangayYieldService.js";
import { handleResponse } from "../utils/handleResponse.js";
import { logService } from "../services/logService.js";

const {
  addBarangayYieldService,
  fetchBarangayYieldsService,
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
    !season ||
    !total_yield ||
    !total_area_planted_ha ||
    !yield_per_hectare
  ) {
    return handleResponse(res, 400, false, "All fields are required");
  }

  try {
    const newYieldRecord = await addBarangayYieldService(
      barangay_id,
      crop_id,
      year,
      season,
      total_yield,
      total_area_planted_ha,
      yield_per_hectare,
      recordedByUserId
    );

    await logService.add({
      userId: req.user.id,
      roleId: req.user.roleID,
      action: "ADD_YIELD",
      targetTable: "barangay_yields",
      targetId: newYieldRecord.yield_id,
      details: newYieldRecord
    });

    return handleResponse(
      res,
      201,
      true,
      "Yield record added successfully (status: pending)",
      newYieldRecord
    );
  } catch (err) {
    next(err);
  }
};

// Fetch all barangay yield records
export const fetchBarangayYields = async (req, res, next) => {
  try {
    const yields = await fetchBarangayYieldsService();
    return handleResponse(res, 200, true, yields, "Barangay yields fetched successfully");
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

    return handleResponse(res, 200, true, "Barangay yield fetched successfully", yieldRecord);
  } catch (err) {
    next(err);
  }
};

// Update barangay yield record
export const updateBarangayYield = async (req, res, next) => {
  const {
    barangay_id,
    crop_id,
    year,
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
      !season &&
      !total_yield &&
      !total_area_planted_ha &&
      !yield_per_hectare
    ) {
      return handleResponse(res, 400, false, "At least one field must be provided to update");
    }

    const updatedYield = await updateBarangayYieldService(
      req.params.id,
      barangay_id,
      crop_id,
      year,
      season,
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
      details: updatedYield
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

    await logService.add({
      userId: req.user.id,
      roleId: req.user.roleID,
      action: "DELETE_YIELD",
      targetTable: "barangay_yields",
      targetId: yieldRecord.yield_id,
      details: yieldRecord
    });

    return handleResponse(res, 200, true, "Yield record deleted successfully", yieldRecord);
  } catch (err) {
    next(err);
  }
};
