import express from 'express';
import { getLogs, getMyLogs } from '../controllers/logController.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { ROLES } from '../config/roles.js';

const router = express.Router();

// technician shortcut
router.get('/my-logs', authenticate, authorizeRoles(ROLES.TECHNICIAN), getMyLogs);

// any authenticated user can fetch their own activity feed
router.get('/self', authenticate, getMyLogs);

// admin and superadmin can view all logs
router.get('/', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.SUPERADMIN), getLogs);

export default router;

