import  barangayYieldService from "../models/barangayYieldModel.js";
import { handleResponse } from "../utils/handleResponse.js";

const { addBarangayYieldService, fetchBarangayYieldsService, deleteBarangayYieldService, fetchBarangayYieldByIdService, updateBarangayYieldService } = barangayYieldService;


//adding barangay yield records (this includes the yields and their seasons) 
export const addBarangayYield = async (req, res, next) => {
  const { 
    barangay_id, 
    crop_id, 
    year, 
    season, 
    total_yield, 
    total_area_planted_ha, 
    yield_per_hectare,
    recorded_by_user_id 
  } = req.body;

  if (
    !barangay_id || 
    !crop_id || 
    !year || 
    !season || 
    !total_yield || 
    !total_area_planted_ha || 
    !yield_per_hectare || 
    !recorded_by_user_id
  ) {
    return res.status(400).json({ error: "All fields are required (including recorded_by_user_id)" });
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
      recorded_by_user_id
    );

    return handleResponse(
      res, 
      201, 
      "Yield record added successfully (status: pending)", 
      newYieldRecord
    );
  } catch (err) {
    next(err);
  }
};



// fetching all yields from the barangay_yields records table
export const fetchBarangayYields = async (req, res, next) => {
  try {
    const yields = await fetchBarangayYieldsService();
    return handleResponse(res, 200, "Fetched successfully", yields);
  } catch (err) {
    next(err);
  }
};

// fetching barangay yield records by ID
export const fetchBarangayYieldById = async (req, res, next) => {
  try {
    const { id } = req.params; // /yields/:id
    const yieldRecord = await fetchBarangayYieldByIdService(id);

    if (!yieldRecord) {
      return handleResponse(res, 404, "Yield record not found");
    }

    return handleResponse(res, 200, "Fetched successfully", yieldRecord);
  } catch (err) {
    next(err);
  }
};



// updating barangay yield record
export const updateBarangayYield = async (req, res, next) => {
  try {
    const { yield_id } = req.params;
    const { barangay_id, crop_id, year, season, total_yield, total_area_planted_ha, yield_per_hectare } = req.body;

    // Optional: validate required fields
    if (!barangay_id || !crop_id || !year || !season || !total_yield || !total_area_planted_ha || !yield_per_hectare) {
      return handleResponse(res, 400, "All fields are required");
    }

    // Call service to update the record
    const updated = await updateBarangayYieldService(
      yield_id,
      barangay_id,
      crop_id,
      year,
      season,
      total_yield,
      total_area_planted_ha,
      yield_per_hectare
    );


    if (!updated) {
      return handleResponse(res, 404, "Yield record not found");
    }

    // Return success response
    return handleResponse(res, 200, "Yield record updated successfully", updated);

  } catch (err) {
    console.error("Error updating yield:", err); 
    next(err);
  }
};


// deleting barangay yield record
export const deleteBarangayYield = async (req, res, next) => {
  try {
    const yieldRecord = await deleteBarangayYieldService(req.params.id);

    if (!yieldRecord) {
      return handleResponse(res, 404, "Yield record not found");
    }

    return handleResponse(res, 200, "Yield record deleted successfully", yieldRecord);
  } catch (err) {
    next(err);
  }
};
