import express from "express";
import { getDashboardMetrics } from "../controllers/dashboardController.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";
import { ROLES } from "../config/roles.js";

const router = express.Router();

router.get(
  "/dashboard/metrics",
  authenticate,
  authorizeRoles(ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.TECHNICIAN),
  getDashboardMetrics
);

export default router;
