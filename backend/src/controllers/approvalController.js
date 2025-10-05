import {
  approveRecordService,
  rejectRecordService,
  fetchLatestApprovalStatusService,
  fetchApprovalsService,
} from '../services/approvalService.js';
import { handleResponse } from '../utils/handleResponse.js';
import { logService } from '../services/logService.js';

// admin approves a record
export const approveRecord = async (req, res, next) => {
  try {
    const recordType = req.recordType || req.params?.recordType;
    const { recordId } = req.params;
    const adminId = req.user?.id;

    const result = await approveRecordService(recordType, recordId, adminId);

    // log the approval (non-blocking)
    try {
      await logService.add({
        userId: req.user?.id || null,
        roleId: req.user?.roleID || req.user?.roleid || null,
        action: "APPROVE_RECORD",
        targetTable: recordType,
        targetId: recordId,
        details: {
          summary: "Record approved",
          recordType,
          approvalReference: Boolean(result?.approval_id),
        },
      });
    } catch (logError) {
      console.error("logService.add failed for APPROVE_RECORD:", logError);
    }

    return handleResponse(res, 200, 'record approved successfully', result);
  } catch (err) {
    console.error('approveRecord failed:', err);
    const statusCode = err?.statusCode ?? 500;
    const message = err?.message || 'failed to approve record';
    const responsePayload = statusCode >= 500
      ? { error: err?.code || 'APPROVAL_ERROR', details: err?.message }
      : null;
    return handleResponse(res, statusCode, message, responsePayload);
  }
};

// admin rejects a record
export const rejectRecord = async (req, res, next) => {
  try {
    const recordType = req.recordType || req.params?.recordType;
    const { recordId } = req.params;
    const adminId = req.user?.id;
    const rawReason = req.body?.reason;
    const reason = typeof rawReason === "string" ? rawReason.trim() : rawReason;

    const result = await rejectRecordService(recordType, recordId, adminId, reason);

    // log the rejection (non-blocking)
    try {
      await logService.add({
        userId: req.user?.id || null,
        roleId: req.user?.roleID || req.user?.roleid || null,
        action: "REJECT_RECORD",
        targetTable: recordType,
        targetId: recordId,
        details: {
          summary: "Record rejected",
          recordType,
          reasonProvided: Boolean(reason),
        },
      });
    } catch (logError) {
      console.error("logService.add failed for REJECT_RECORD:", logError);
    }

    return handleResponse(res, 200, 'record rejected successfully', result);
  } catch (err) {
    console.error('rejectRecord failed:', err);
    const statusCode = err?.statusCode ?? 500;
    const message = err?.message || 'failed to reject record';
    const responsePayload = statusCode >= 500
      ? { error: err?.code || 'APPROVAL_ERROR', details: err?.message }
      : null;
    return handleResponse(res, statusCode, message, responsePayload);
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

    return handleResponse(res, 200, 'fetched latest approval status', result);
  } catch (err) {
    next(err);
  }
};

// fetch all pending approvals (for admin dashboard)
export const fetchPendingApprovals = async (req, res, next) => {
  try {
    const recordTypeParam = (req.params?.recordType || req.query?.recordType || "").toLowerCase() || null;
  const statusParamRaw = (req.query?.status || "pending").toLowerCase();
  const statusParam = statusParamRaw === "all" ? null : statusParamRaw;
    const searchTerm = req.query?.q || req.query?.search || null;

    const result = await fetchApprovalsService({
      recordType: recordTypeParam,
      status: statusParam,
      searchTerm,
    });

    return handleResponse(res, 200, 'fetched pending approvals', result);
  } catch (err) {
    console.error('fetchPendingApprovals failed:', err);
    next(err);
  }
};
