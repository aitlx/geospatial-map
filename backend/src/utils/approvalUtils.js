import pool from "../config/db.js";

// record type → table mapping
export const RECORD_CONFIG = {
  crop_prices: { table: "barangay_crop_prices", id: "price_id" },
  barangay_yields: { table: "barangay_yields", id: "yield_id" },
};

// Technician submits a record → mark main table pending + insert pending approval
export const insertPendingApproval = async (recordType, recordId, technicianId) => {
  const config = RECORD_CONFIG[recordType];
  if (!config) throw new Error("Invalid record type");

  // Update main table to pending
  const updateQuery = `
    UPDATE ${config.table}
    SET status = 'pending'
    WHERE ${config.id} = $1
    RETURNING *`;
  const updateResult = await pool.query(updateQuery, [recordId]);
  
  if (updateResult.rows.length === 0) {
    throw new Error(`Record with ID ${recordId} not found`);
  }
  
  const mainRow = updateResult.rows[0];

  // Insert into approvals table (submitted_by → technician, status = pending)
  const approvalQuery = `
    INSERT INTO approvals (record_type, record_id, status, submitted_by, reason, performed_at)
    VALUES ($1, $2, 'pending', $3, 'Awaiting review', NOW())
    RETURNING *`;
  
  const approvalResult = await pool.query(approvalQuery, [
    recordType,
    recordId,
    technicianId,
  ]);

  return {
    mainTable: mainRow,
    approval: approvalResult.rows[0],
  };
};

// Admin approves/rejects → update main table + update approval log
export const updateRecordStatusAndInsertApproval = async (
  recordType,
  recordId,
  status,      // 'approved' | 'rejected'
  adminId,
  reason = "N/A"
) => {
  const config = RECORD_CONFIG[recordType];
  if (!config) throw new Error("Invalid record type");

  // Fetch current status
  const { rows } = await pool.query(
    `SELECT status FROM ${config.table} WHERE ${config.id} = $1`,
    [recordId]
  );
  if (!rows.length) throw new Error("Record not found");

  // Update main table status
  const mainTableResult = await pool.query(
    `UPDATE ${config.table} SET status = $1 WHERE ${config.id} = $2 RETURNING *`,
    [status, recordId]
  );

  // Update the existing pending approval record
  const approvalQuery = `
    UPDATE approvals 
    SET status = $1, performed_by = $2, reason = $3, performed_at = NOW()
    WHERE record_type = $4 AND record_id = $5 AND status = 'pending'
    RETURNING *`;
  
  const approvalResult = await pool.query(approvalQuery, [
    status,
    adminId,
    reason,
    recordType,
    recordId,
  ]);

  return {
    mainTable: mainTableResult.rows[0],
    approval: approvalResult.rows[0],
  };
};