import express from "express";
import {
  addBarangayYield,
  fetchBarangayYields,
  fetchBarangayYieldById,
  updateBarangayYield,
  deleteBarangayYield
} from "../controllers/barangayYieldController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", authenticate, addBarangayYield);
router.get("/", authenticate, fetchBarangayYields);
router.get("/:id", authenticate, fetchBarangayYieldById);
router.put("/:id", authenticate, updateBarangayYield);
router.delete("/:id", authenticate, deleteBarangayYield);

export default router;
