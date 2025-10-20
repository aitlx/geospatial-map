import express from 'express'
import { createManualBackup, getAllBackups, downloadBackup, deleteBackup, uploadBackup, downloadBackupById } from '../controllers/backupController.js'
import { uploadBackupFile } from '../middleware/backupUploadMiddleware.js'
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js'
import { ROLES } from '../config/roles.js'

const router = express.Router()

router.post('/create', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.SUPERADMIN), createManualBackup)
router.post('/upload', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.SUPERADMIN), uploadBackupFile, uploadBackup)
router.get('/list', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.SUPERADMIN), getAllBackups)
// download by backup id first
router.get('/:id/download', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.SUPERADMIN), downloadBackupById)
// download by filename (kept for legacy direct filename access)
router.get('/download/:filename', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.SUPERADMIN), downloadBackup)
router.delete('/:id', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.SUPERADMIN), deleteBackup)

export default router
