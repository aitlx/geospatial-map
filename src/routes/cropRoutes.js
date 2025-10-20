import express from "express";
import {
  addCrop,
  fetchAllCrops,
  fetchCropById,
  deleteCrop,
  updateCrop,
  fetchCropsDropdown
} from "../controllers/cropsController.js"; 

const router = express.Router();

router.post("/", addCrop);
router.get("/", fetchAllCrops);
router.get("/dropdown", fetchCropsDropdown);
router.get("/:id", fetchCropById);
router.delete("/:id", deleteCrop);
router.put("/:id", updateCrop);

export default router;
