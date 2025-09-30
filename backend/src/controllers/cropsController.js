import cropService from "../services/cropsService.js";
import { handleResponse } from "../utils/handleResponse.js";
import { logService } from "../services/logService.js";

const { 
  addCropService, 
  fetchAllCropsService, 
  deleteCropService, 
  fetchCropByIdService, 
  updateCropService 
} = cropService;

// adding crops
export const addCrop = async (req, res, next) => {
  const { crop_name, category, planting_season } = req.body;

  try {
    const newCrop = await addCropService(crop_name, category, planting_season);

    // log creation
    await logService.add({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "ADD_CROP",
      targetTable: "crops",
      targetId: newCrop.id,
      details: newCrop
    });

    return handleResponse(res, 201, "crop added successfully", newCrop);
  } catch (err) {
    next(err);
  }
};

// fetching crops by id
export const fetchCropById = async (req, res, next) => {
  try {
    const cropId = req.params.id;
    const crop = await fetchCropByIdService(cropId);

    if (!crop) {
      return handleResponse(res, 404, "crop not found");
    }

    return handleResponse(res, 200, "crop fetched successfully", crop);
  } catch (err) {
    next(err);
  }
};

// updating crop details 
export const updateCrop = async (req, res, next) => {
  const { crop_name, category, planting_season } = req.body;

  try {
    if (!crop_name && !category && !planting_season) {
      return handleResponse(res, 400, "at least one field (crop_name, category, planting_season) must be provided");
    }

    const crop = await updateCropService(
      req.params.id,
      crop_name,
      category,
      planting_season
    );

    if (!crop) {
      return handleResponse(res, 404, "crop not found");
    }

    // log update
    await logService.add({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "UPDATE_CROP",
      targetTable: "crops",
      targetId: crop.id,
      details: crop
    });

    return handleResponse(res, 200, "crop information updated successfully", crop);
  } catch (err) {
    next(err);
  }
};

// deleting crop
export const deleteCrop = async (req, res, next) => {
  try {
    const crop = await deleteCropService(req.params.id);

    if (!crop) {
      return handleResponse(res, 404, "crop not found");
    }

    // log deletion
    await logService.add({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "DELETE_CROP",
      targetTable: "crops",
      targetId: crop.id,
      details: crop
    });

    return handleResponse(res, 200, "crop deleted successfully", crop);
  } catch (err) {
    next(err);
  }
};

// fetching all crops
export const fetchAllCrops = async (req, res, next) => {
  try {
    const crops = await fetchAllCropsService();
    return handleResponse(res, 200, "crops fetched successfully", crops);
  } catch (err) {
    next(err);
  }
};


// fetch crops for dropdown
export const fetchCropsDropdown = async (req, res, next) => {
  try {
    const crops = await fetchAllCropsService();

    
    const dropdown = crops.map(crop => ({
      id: crop.crop_id,      
      name: crop.crop_name
    }));

    return handleResponse(res, 200, true, dropdown, "Crops fetched for dropdown");
  } catch (err) {
    next(err);
  }
};
