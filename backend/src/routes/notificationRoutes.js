import express from "express";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";
import { getTechnicianNotifications } from "../controllers/notificationController.js";
import { ROLES } from "../config/roles.js";

const router = express.Router();

router.get(
  "/notifications/technician",
  authenticate,
  authorizeRoles(ROLES.TECHNICIAN),
  getTechnicianNotifications
);

export default router;
