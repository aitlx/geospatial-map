import barangayCropPriceService from "../services/barangayCropPriceService.js";
import { handleResponse } from "../utils/handleResponse.js";
import { logService } from "../services/logService.js";

const { 
  addBarangayCropPriceService, 
  fetchAllBarangayCropPricesService, 
  fetchBarangayCropPricesByUserService, 
  fetchBarangayCropPriceByIdService, 
  updateBarangayCropPriceService, 
  deleteBarangayCropPriceService 
} = barangayCropPriceService;

// adding barangay crop price records
export const addCropPrice = async (req, res, next) => {
  const { barangay_id, crop_id, price_per_kg, year, month, season } = req.body;
  const recorded_by_user_id = req.user.id;

  if (!barangay_id || !crop_id || !price_per_kg || !season || !month) {
    return handleResponse(res, 400, "missing required fields");
  }

  const normalizedMonth = Number(month);
  if (!Number.isInteger(normalizedMonth) || normalizedMonth < 1 || normalizedMonth > 12) {
    return handleResponse(res, 400, "Month must be an integer between 1 and 12");
  }

  try {
    const finalYear = year || new Date().getFullYear();
    const newPrice = await addBarangayCropPriceService(
      barangay_id,
      crop_id,
      price_per_kg,
      finalYear,
      normalizedMonth,
      season,
      recorded_by_user_id
    );

    // log creation
    await logService.add({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "ADD_CROP_PRICE",
      targetTable: "barangay_crop_prices",
      targetId: newPrice.price_id,
      details: {
        summary: "Crop price recorded",
        period: { year: finalYear, month: normalizedMonth, season },
        priceProvided: price_per_kg !== undefined && price_per_kg !== null,
        barangayReference: Boolean(barangay_id),
        cropReference: Boolean(crop_id),
      },
    });

    return handleResponse(res, 201, "crop price record added successfully (status: pending)", newPrice);
  } catch (err) {
    console.error("add crop price error:", err);
    return handleResponse(res, 500, "internal server error");
  }
};

// fetching all crop prices
export const fetchCropPrices = async (req, res, next) => {
  try {
    const mineFlag = (req.query.mine || "").toString().toLowerCase();
    const showMine = ["true", "1", "yes", "me", "self"].includes(mineFlag);
    const statusFilterRaw = (req.query.status || "").toString().trim().toLowerCase();
    const statusFilter = statusFilterRaw && statusFilterRaw !== "all" ? statusFilterRaw : null;

    const cropPrices = showMine && req.user?.id
      ? await fetchBarangayCropPricesByUserService(req.user.id, { status: statusFilter })
      : await fetchAllBarangayCropPricesService({ status: statusFilter });

    return handleResponse(res, 200, "crop prices fetched successfully", cropPrices);
  } catch (err) {
    console.error("fetch crop prices error:", err);
    return handleResponse(res, 500, "internal server error");
  }
};

// fetching crop price by id
export const fetchCropPriceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const price = await fetchBarangayCropPriceByIdService(id);

    if (!price) {
      return handleResponse(res, 404, "crop price record not found");
    }

    return handleResponse(res, 200, "crop price record fetched successfully", price);
  } catch (err) {
    console.error("fetch crop price by id error:", err);
    return handleResponse(res, 500, "internal server error");
  }
};

// updating crop price record

export const updateCropPrice = async (req, res, next) => {
  const { price_per_kg, year, month, season, barangay_id, crop_id } = req.body; // added barangay_id and crop_id
  const { id } = req.params;

  try {
    // make sure at least one field is provided
    if (!price_per_kg && !year && !month && !season && !barangay_id && !crop_id) {
      return handleResponse(res, 400, "at least one field must be provided");
    }

    let normalizedMonth = month;
    if (month !== undefined) {
      const parsed = Number(month);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
        return handleResponse(res, 400, "Month must be an integer between 1 and 12");
      }
      normalizedMonth = parsed;
    }

    // send all fields to the service function
    const updatedPrice = await updateBarangayCropPriceService(
      id, 
      price_per_kg, 
      year, 
      normalizedMonth,
      season,
      barangay_id,  
      crop_id      
    );

    if (!updatedPrice) {
      return handleResponse(res, 404, "crop price record not found");
    }

    // log the update
    await logService.add({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "UPDATE_CROP_PRICE",
      targetTable: "barangay_crop_prices",
      targetId: updatedPrice.price_id,
      details: {
        summary: "Crop price updated",
        updatedFields: Object.keys(req.body ?? {}),
      },
    });

    return handleResponse(res, 200, "crop price record updated successfully", updatedPrice);
  } catch (err) {
    console.error("update crop price error:", err);
    return handleResponse(res, 500, "internal server error");
  }
};

// deleting crop price record
export const deleteCropPrice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deletedPrice = await deleteBarangayCropPriceService(id);

    if (!deletedPrice) {
      return handleResponse(res, 404, "crop price record not found");
    }

    // log deletion
    await logService.add({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "DELETE_CROP_PRICE",
      targetTable: "barangay_crop_prices",
      targetId: deletedPrice.price_id,
      details: {
        summary: "Crop price deleted",
        period: { year: deletedPrice.year, month: deletedPrice.month, season: deletedPrice.season },
        hadPrice: deletedPrice.price_per_kg !== undefined && deletedPrice.price_per_kg !== null,
        barangayReference: Boolean(deletedPrice?.barangay_id),
        cropReference: Boolean(deletedPrice?.crop_id),
      },
    });

    return handleResponse(res, 200, "crop price record deleted successfully", deletedPrice);
  } catch (err) {
    console.error("delete crop price error:", err);
    return handleResponse(res, 500, "internal server error");
  }
};
