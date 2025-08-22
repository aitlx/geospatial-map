import express from "express";
import {
  addBarangayYield,
  fetchBarangayYields,
  fetchBarangayYieldById,
  updateBarangayYield,
  deleteBarangayYield
} from "../controllers/barangayYieldController.js";

const router = express.Router();

router.post("/", addBarangayYield);
router.get("/", fetchBarangayYields);
router.get("/:id", fetchBarangayYieldById);
router.put("/:id", updateBarangayYield);
router.delete("/:id", deleteBarangayYield);

export default router;
