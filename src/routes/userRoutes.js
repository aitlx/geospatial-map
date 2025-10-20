import express from "express";
import {
  createUser,
  fetchAllUsers,
  fetchRoleSummary,
  fetchUserById,
  deleteUser,
  updateUser,
  getCurrentUser,
  resendVerification,
  resetTechnicianPassword,
} from "../controllers/adminUserController.js";
import { resendVerificationLinkLegacy } from "../controllers/verifyEmailController.js";
import { authenticate, authorizeRoles, canAccessSelfOrAdmin } from "../middleware/authMiddleware.js";
import { ROLES } from "../config/roles.js";

const router = express.Router();

/**
 * rbac rules:
 * - superadmin (1) → full access
 * - admin (2) → read and update technician accounts 
 * - technician (3) → can only view and update self
 */


// legacy public resend endpoint for old verification links (no authentication)
router.get("/user/:id/resend-verification", resendVerificationLinkLegacy);

// get current logged-in user → all authenticated users
router.get("/user/me", authenticate, getCurrentUser);

// create user → superadmins and admins
router.post("/user", authenticate, authorizeRoles(ROLES.SUPERADMIN, ROLES.ADMIN), createUser);

// fetch all users → superadmins and admins
router.get("/user", authenticate, authorizeRoles(ROLES.SUPERADMIN, ROLES.ADMIN), fetchAllUsers);

// role summary → superadmins only
router.get(
  "/user/roles/summary",
  authenticate,
  authorizeRoles(ROLES.SUPERADMIN),
  fetchRoleSummary
);

// fetch user by id → superadmins and admins can access anyone, technicians only self
router.get("/user/:id", authenticate, canAccessSelfOrAdmin, fetchUserById);

// update user → superadmins and admins can update anyone, technicians only self
router.put("/user/:id", authenticate, canAccessSelfOrAdmin, updateUser);

// resend verification code for technician → superadmins and admins
router.post(
  "/user/:id/resend-verification",
  authenticate,
  authorizeRoles(ROLES.SUPERADMIN, ROLES.ADMIN),
  resendVerification
);

// issue a temporary password → superadmins and admins
router.post(
  "/user/:id/reset-password",
  authenticate,
  authorizeRoles(ROLES.SUPERADMIN, ROLES.ADMIN),
  resetTechnicianPassword
);

// delete user → superadmins and admins
router.delete("/user/:id", authenticate, authorizeRoles(ROLES.SUPERADMIN, ROLES.ADMIN), deleteUser);

export default router;
