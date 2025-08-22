import  cropService from "../models/cropsModel.js";
import { handleResponse } from "../utils/handleResponse.js";

const { addCropService, fetchAllCropsService, deleteCropService, fetchCropByIdService, updateCropService } = cropService;


//adding crops
export const addCrop = async (req, res, next) => {
    const { crop_name, category, planting_season } = req.body;
        try {
            const newCrop = await addCropService(crop_name, category, planting_season);
            return handleResponse(res, 201, "Crop added successfully", newCrop);
        } catch (err) {
            next(err);
    }
};


//fetching crops by ID
export const fetchCropById = async (req, res, next) => {
  try {
    const cropId = req.params.id;
    const crop = await fetchCropByIdService(cropId);

    if (!crop) {
      return handleResponse(res, 404, "Crop not found");
    }

    return handleResponse(res, 200, "Crop fetched successfully", crop);
  } catch (err) {
    next(err);
  }
};

export const updateCrop = async (req, res, next) => {
  const { crop_name, category, planting_season } = req.body;

  try {
    if (!crop_name && !category && !planting_season) {
      return handleResponse(res, 400, "At least one field (crop_name, category, planting_season) must be provided");
    }

    const crop = await updateCropService(
      req.params.id,
      crop_name,
      category,
      planting_season
    );

    if (!crop) {
      return handleResponse(res, 404, "Crop not found");
    }

    return handleResponse(res, 200, "Crop information updated successfully", crop);
  } catch (err) {
    next(err);
  }
};


export const deleteCrop = async (req, res, next) => {
  try {
    const crop = await deleteCropService(req.params.id);

    if (!crop) {
      return handleResponse(res, 404, "Crop not found");
    }

    return handleResponse(res, 200, "Crop deleted successfully", crop);
  } catch (err) {
    next(err);
  }
};

export const fetchAllCrops = async (req, res, next) => {
  try {
    const crops = await fetchAllCropsService();
    handleResponse(res, 200, "Crops fetched successfully", crops);
  } catch (err) {
    next(err);
  }
};

