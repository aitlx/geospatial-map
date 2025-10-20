import express from 'express';
import {
  approveRecord,
  rejectRecord,
  fetchLatestApprovalStatus,
  fetchPendingApprovals,
} from '../controllers/approvalController.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { validateRecordType } from '../middleware/validateRecordType.js';
import { handleResponse } from '../utils/handleResponse.js';
import { ROLES } from '../config/roles.js';

const router = express.Router();


// admin approves a record
const adminApprovalGuards = [
  authenticate,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPERADMIN),
  validateRecordType,
];

router.put('/approve/:recordType/:recordId', adminApprovalGuards, approveRecord);
router.post('/approve/:recordType/:recordId', adminApprovalGuards, approveRecord);
router.get('/approve/:recordType/:recordId', adminApprovalGuards, approveRecord);

// admin rejects a record
router.put('/reject/:recordType/:recordId', adminApprovalGuards, rejectRecord);
router.post('/reject/:recordType/:recordId', adminApprovalGuards, rejectRecord);
router.get('/reject/:recordType/:recordId', adminApprovalGuards, rejectRecord);

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
