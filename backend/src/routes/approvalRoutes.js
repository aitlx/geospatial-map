import express from 'express';
import {
  approveRecord,
  rejectRecord,
  fetchLatestApprovalStatus,
  fetchPendingApprovals,
} from '../controllers/approvalController.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { validateRecordType } from '../middleware/validateRecordType.js';
import { ROLES } from '../config/roles.js';

const router = express.Router();


// admin approves a record
router.put(
  '/approve/:recordType/:recordId',
  authenticate,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPERADMIN),
  validateRecordType,
  approveRecord
);

// admin rejects a record
router.put(
  '/reject/:recordType/:recordId',
  authenticate,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPERADMIN),
  validateRecordType,
  rejectRecord
);

// get the latest status of a specific record
router.get(
  '/status/:recordType/:recordId',
  authenticate,
  validateRecordType,
  fetchLatestApprovalStatus
);

// list all records that are still pending (for admins)
router.get(
  '/pending',
  authenticate,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPERADMIN),
  fetchPendingApprovals
);

export default router;
