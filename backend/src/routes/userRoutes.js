import express from "express";
import {
  createUser,
  fetchAllUsers,
  fetchUserById,
  deleteUser,
  updateUser,
  getCurrentUser,
} from "../controllers/adminUserController.js";
import { authenticate, authorizeRoles, canAccessSelfOrAdmin } from "../middleware/authMiddleware.js";
import { ROLES } from "../config/roles.js";

const router = express.Router();

/**
 * rbac rules:
 * - superadmin (1) → full access
 * - admin (2) → read and update technician accounts 
 * - technician (3) → can only view and update self
 */


// get current logged-in user → all authenticated users
router.get("/user/me", authenticate, getCurrentUser);

// create user → only superadmins
router.post("/user", authenticate, authorizeRoles(ROLES.SUPERADMIN), createUser);

// fetch all users → superadmins and admins
router.get("/user", authenticate, authorizeRoles(ROLES.SUPERADMIN, ROLES.ADMIN), fetchAllUsers);

// fetch user by id → superadmins and admins can access anyone, technicians only self
router.get("/user/:id", authenticate, canAccessSelfOrAdmin, fetchUserById);

// update user → superadmins and admins can update anyone, technicians only self
router.put("/user/:id", authenticate, canAccessSelfOrAdmin, updateUser);

// delete user → only superadmins
router.delete("/user/:id", authenticate, authorizeRoles(ROLES.SUPERADMIN), deleteUser);

export default router;
