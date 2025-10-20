import pool from "../config/db.js";

// record type → table mapping
export const RECORD_CONFIG = {
  crop_prices: {
    table: "barangay_crop_prices",
    id: "price_id",
    dbRecordType: "crop_prices",
  },
  barangay_crop_prices: {
    table: "barangay_crop_prices",
    id: "price_id",
    dbRecordType: "crop_prices",
  },
  barangay_yields: {
    table: "barangay_yields",
    id: "yield_id",
    dbRecordType: "barangay_yields",
  },
};

const RECORD_TYPE_ALIASES = {
  crop_price: "crop_prices",
  "crop-prices": "crop_prices",
  barangay_yield: "barangay_yields",
  "barangay-yield": "barangay_yields",
  "barangay-yields": "barangay_yields",
  barangay_crop_price: "barangay_crop_prices",
  "barangay-crop-price": "barangay_crop_prices",
  "barangay-crop-prices": "barangay_crop_prices",
};

export const createApprovalError = (message, statusCode = 500, code = "APPROVAL_ERROR") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

export const normalizeRecordTypeKey = (value) => {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, "_");
  if (!normalized.length) {
    return null;
  }

  if (RECORD_CONFIG[normalized]) {
    return normalized;
  }

  const aliasKey = normalized.replace(/-/g, "_");
  if (RECORD_CONFIG[aliasKey]) {
    return aliasKey;
  }

  const alias = RECORD_TYPE_ALIASES[normalized] || RECORD_TYPE_ALIASES[aliasKey];
  if (alias && RECORD_CONFIG[alias]) {
    return alias;
  }

  return null;
};

export const resolveDbRecordType = (recordType) => {
  const normalized = normalizeRecordTypeKey(recordType) ?? recordType;
  const config = RECORD_CONFIG[normalized];
  if (!config) {
    return normalized;
  }
  return config.dbRecordType || normalized;
};

// Technician submits a record → mark main table pending + insert pending approval
export const insertPendingApproval = async (recordType, recordId, technicianId) => {
  const normalizedType = normalizeRecordTypeKey(recordType);
  if (!normalizedType) {
    throw createApprovalError(`Invalid record type: ${recordType}`, 400, "INVALID_RECORD_TYPE");
  }

  const config = RECORD_CONFIG[normalizedType];
  const dbRecordType = resolveDbRecordType(normalizedType);

  const updateQuery = `
    UPDATE ${config.table}
       SET status = 'pending'
     WHERE CAST(${config.id} AS TEXT) = CAST($1 AS TEXT)
     RETURNING *`;

  const updateResult = await pool.query(updateQuery, [recordId]);

  if (updateResult.rows.length === 0) {
    throw createApprovalError(`Record with ID ${recordId} not found in ${config.table}`, 404, "RECORD_NOT_FOUND");
  }

  const mainRow = updateResult.rows[0];

  const approvalQuery = `
    INSERT INTO approvals (record_type, record_id, status, submitted_by, reason, performed_at)
    VALUES ($1, $2, 'pending', $3, 'Awaiting review', NOW())
    RETURNING *`;

  const approvalResult = await pool.query(approvalQuery, [dbRecordType, recordId, technicianId]);

  return {
    mainTable: mainRow,
    approval: approvalResult.rows[0],
  };
};

// Admin approves/rejects → update main table + update approval log
export const updateRecordStatusAndInsertApproval = async (
  recordType,
  recordId,
  status, // 'approved' | 'rejected'
  adminId,
  reason = "N/A"
) => {
  const normalizedType = normalizeRecordTypeKey(recordType);
  if (!normalizedType) {
    throw createApprovalError(`Invalid record type: ${recordType}`, 400, "INVALID_RECORD_TYPE");
  }

  const config = RECORD_CONFIG[normalizedType];
  const dbRecordType = resolveDbRecordType(normalizedType);
  const client = await pool.connect();
  let transactionBegan = false;

  try {
    await client.query("BEGIN");
    transactionBegan = true;

    const currentStatusResult = await client.query(
      `SELECT status
         FROM ${config.table}
        WHERE CAST(${config.id} AS TEXT) = CAST($1 AS TEXT)
        FOR UPDATE`,
      [recordId]
    );

    if (!currentStatusResult.rows.length) {
      throw createApprovalError(`Record ${recordId} not found in ${config.table}`, 404, "RECORD_NOT_FOUND");
    }

    const pendingApprovalResult = await client.query(
      `SELECT id
         FROM approvals
        WHERE record_type = $1
          AND CAST(record_id AS TEXT) = CAST($2 AS TEXT)
          AND status = 'pending'
        ORDER BY performed_at DESC
        LIMIT 1
        FOR UPDATE`,
      [dbRecordType, recordId]
    );

    if (!pendingApprovalResult.rows.length) {
      throw createApprovalError("No pending approval exists for this record.", 409, "NO_PENDING_APPROVAL");
    }

    const pendingApprovalId = pendingApprovalResult.rows[0].id;

    const updatedMainResult = await client.query(
      `UPDATE ${config.table}
          SET status = $1
        WHERE CAST(${config.id} AS TEXT) = CAST($2 AS TEXT)
        RETURNING *`,
      [status, recordId]
    );

    const updatedApprovalResult = await client.query(
      `UPDATE approvals
          SET status = $1,
              performed_by = $2,
              reason = $3,
              performed_at = NOW()
        WHERE id = $4
        RETURNING *`,
      [status, adminId ?? null, reason, pendingApprovalId]
    );

    await client.query("COMMIT");

    return {
      mainTable: updatedMainResult.rows[0] ?? null,
      approval: updatedApprovalResult.rows[0] ?? null,
    };
  } catch (error) {
    console.error('updateRecordStatusAndInsertApproval error:', {
      recordType,
      recordId,
      status,
      adminId,
      message: error?.message,
      code: error?.code,
    });
    if (transactionBegan) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
};