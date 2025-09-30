import { updateRecordStatusAndInsertApproval, RECORD_CONFIG } from '../utils/approvalUtils.js';
import pool from '../config/db.js';

// approve a record
export const approveRecordService = async (recordType, recordId, adminId) => {
  return await updateRecordStatusAndInsertApproval(recordType, recordId, 'approved', adminId, 'N/A');
};

// reject a record
export const rejectRecordService = async (recordType, recordId, adminId, reason) => {
  return await updateRecordStatusAndInsertApproval(
    recordType,
    recordId,
    'rejected',
    adminId,
    reason || 'No reason provided'
  );
};

// fetch latest approval status
export const fetchLatestApprovalStatusService = async (recordType, recordId) => {
  const result = await pool.query(
    `SELECT * FROM approvals
     WHERE record_type = $1 AND record_id = $2
     ORDER BY performed_at DESC
     LIMIT 1`,
    [recordType, recordId]
  );
  return result.rows[0] || null;
};

// fetch all pending approvals
export const fetchPendingApprovalsService = async (recordType) => {
  const config = RECORD_CONFIG[recordType];
  if (!config) throw new Error('Invalid record type');

  const result = await pool.query(
    `SELECT * FROM ${config.table} WHERE status = 'pending'`
  );
  return result.rows;
};
