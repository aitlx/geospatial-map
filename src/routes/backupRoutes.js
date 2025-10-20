import express from "express"
import { createBackup, deleteBackup, downloadBackup, listBackups } from "../controllers/backupController.js"
import { uploadBackupFile } from "../middleware/backupUploadMiddleware.js"
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js"
import { ROLES } from "../config/roles.js"

const router = express.Router()

router.get("/", authenticate, authorizeRoles(ROLES.SUPERADMIN), listBackups)
router.post("/", authenticate, authorizeRoles(ROLES.SUPERADMIN), uploadBackupFile, createBackup)
router.get("/:id/download", authenticate, authorizeRoles(ROLES.SUPERADMIN), downloadBackup)
router.delete("/:id", authenticate, authorizeRoles(ROLES.SUPERADMIN), deleteBackup)

export default router
