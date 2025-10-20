import cropService from "../services/cropsService.js";
import { handleResponse } from "../utils/handleResponse.js";
import { logService } from "../services/logService.js";

const {
  addCropService,
  fetchAllCropsService,
  deleteCropService,
  fetchCropByIdService,
  updateCropService,
} = cropService;

const normalizeCropName = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeCategory = (value) => {
  if (value === null) return null;
  if (value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const resolveCropId = (crop) => crop?.crop_id ?? crop?.id ?? null;

const safelyLog = async (payload) => {
  try {
    await logService.add(payload);
  } catch (error) {
    if ((process?.env?.NODE_ENV ?? "development") !== "production") {
      console.warn("Failed to record crop log entry", error);
    }
  }
};

// adding crops
export const addCrop = async (req, res, next) => {
  const cropName = normalizeCropName(req.body?.crop_name);
  const category = normalizeCategory(req.body?.category);

  try {
    if (!cropName) {
      return handleResponse(res, 400, "crop_name is required");
    }

    const newCrop = await addCropService(cropName, category);
    const cropId = resolveCropId(newCrop);

    // log creation
    await safelyLog({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "ADD_CROP",
      targetTable: "crops",
      targetId: cropId,
      details: {
        summary: "Crop added",
        providedCategory: Boolean(category),
      },
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
  const cropId = req.params.id;
  const requestedName = req.body?.crop_name;
  const requestedCategory = req.body?.category;

  try {
    const crop = await fetchCropByIdService(cropId);

    if (!crop) {
      return handleResponse(res, 404, "crop not found");
    }

    const updates = {};

    if (requestedName !== undefined) {
      const normalizedName = normalizeCropName(requestedName);
      if (!normalizedName) {
        return handleResponse(res, 400, "crop_name cannot be empty");
      }
      updates.crop_name = normalizedName;
    }

    if (requestedCategory !== undefined) {
      updates.category = normalizeCategory(requestedCategory);
    }

    if (!Object.keys(updates).length) {
      return handleResponse(res, 400, "at least one field (crop_name, category) must be provided");
    }

    const updatedCrop = await updateCropService(cropId, updates);

    if (!updatedCrop) {
      return handleResponse(res, 404, "crop not found");
    }

    // log update
    await safelyLog({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "UPDATE_CROP",
      targetTable: "crops",
      targetId: resolveCropId(updatedCrop),
      details: {
        summary: "Crop updated",
        updatedFields: Object.keys(req.body ?? {}),
      },
    });

    return handleResponse(res, 200, "crop information updated successfully", updatedCrop);
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
    await safelyLog({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "DELETE_CROP",
      targetTable: "crops",
      targetId: resolveCropId(crop),
      details: {
        summary: "Crop deleted",
        categoryPresent: Boolean(crop?.category),
      },
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
