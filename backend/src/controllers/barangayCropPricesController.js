import barangayCropPriceService from "../services/barangayCropPriceService.js";
import { handleResponse } from "../utils/handleResponse.js";
import { logService } from "../services/logService.js";

const { 
  addBarangayCropPriceService, 
  fetchAllBarangayCropPricesService, 
  fetchBarangayCropPriceByIdService, 
  updateBarangayCropPriceService, 
  deleteBarangayCropPriceService 
} = barangayCropPriceService;

// adding barangay crop price records
export const addCropPrice = async (req, res, next) => {
  const { barangay_id, crop_id, price_per_kg, year, season } = req.body;
  const recorded_by_user_id = req.user.id;

  if (!barangay_id || !crop_id || !price_per_kg || !season) {
    return handleResponse(res, 400, "missing required fields");
  }

  try {
    const finalYear = year || new Date().getFullYear();
    const newPrice = await addBarangayCropPriceService(
      barangay_id, crop_id, price_per_kg, finalYear, season, recorded_by_user_id
    );

    // log creation
    await logService.add({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "ADD_CROP_PRICE",
      targetTable: "barangay_crop_prices",
      targetId: newPrice.id,
      details: newPrice
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
    const cropPrices = await fetchAllBarangayCropPricesService();
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
  const { price_per_kg, year, season, barangay_id, crop_id } = req.body; // added barangay_id and crop_id
  const { id } = req.params;

  try {
    // make sure at least one field is provided
    if (!price_per_kg && !year && !season && !barangay_id && !crop_id) {
      return handleResponse(res, 400, "at least one field must be provided");
    }

    // send all fields to the service function
    const updatedPrice = await updateBarangayCropPriceService(
      id, 
      price_per_kg, 
      year, 
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
      targetId: updatedPrice.id,
      details: updatedPrice
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
      targetId: deletedPrice.id,
      details: deletedPrice
    });

    return handleResponse(res, 200, "crop price record deleted successfully", deletedPrice);
  } catch (err) {
    console.error("delete crop price error:", err);
    return handleResponse(res, 500, "internal server error");
  }
};
