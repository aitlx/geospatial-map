import {
  approveRecordService,
  rejectRecordService,
  fetchLatestApprovalStatusService,
  fetchPendingApprovalsService,
} from '../services/approvalService.js';
import { handleResponse } from '../utils/handleResponse.js';
import { logService } from '../services/logService.js';

// admin approves a record
export const approveRecord = async (req, res, next) => {
  try {
    const { recordType, recordId } = req.params;
    const adminId = req.user?.id;

    const result = await approveRecordService(recordType, recordId, adminId);

    // log the approval
    await logService.add({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "APPROVE_RECORD",
      targetTable: recordType,
      targetId: recordId,
      details: result
    });

    return handleResponse(res, 200, 'record approved successfully', result);
  } catch (err) {
    next(err);
  }
};

// admin rejects a record
export const rejectRecord = async (req, res, next) => {
  try {
    const { recordType, recordId } = req.params;
    const adminId = req.user?.id;
    const { reason } = req.body;

    const result = await rejectRecordService(recordType, recordId, adminId, reason);

    // log the rejection
    await logService.add({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "REJECT_RECORD",
      targetTable: recordType,
      targetId: recordId,
      details: { ...result, reason }
    });

    return handleResponse(res, 200, 'record rejected successfully', result);
  } catch (err) {
    next(err);
  }
};

// fetch latest approval status for a record
export const fetchLatestApprovalStatus = async (req, res, next) => {
  try {
    const { recordType, recordId } = req.params;

    const result = await fetchLatestApprovalStatusService(recordType, recordId);

    if (!result) {
      return handleResponse(res, 404, 'no approval status found');
    }

    // log the fetch
    await logService.add({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "FETCH_APPROVAL_STATUS",
      targetTable: recordType,
      targetId: recordId,
      details: result
    });

    return handleResponse(res, 200, 'fetched latest approval status', result);
  } catch (err) {
    next(err);
  }
};

// fetch all pending approvals (for admin dashboard)
export const fetchPendingApprovals = async (req, res, next) => {
  try {
    const { recordType } = req.params;

    const result = await fetchPendingApprovalsService(recordType);

    // log the fetch
    await logService.add({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "FETCH_PENDING_APPROVALS",
      targetTable: recordType,
      targetId: null,
      details: result
    });

    return handleResponse(res, 200, 'fetched pending approvals', result);
  } catch (err) {
    next(err);
  }
};
