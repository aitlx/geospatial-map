import {
  updateRecordStatusAndInsertApproval,
  resolveDbRecordType,
  normalizeRecordTypeKey,
} from '../utils/approvalUtils.js';
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
  const dbRecordType = resolveDbRecordType(recordType);
  const result = await pool.query(
    `SELECT * FROM approvals
     WHERE record_type = $1 AND record_id = $2
     ORDER BY performed_at DESC
     LIMIT 1`,
    [dbRecordType, recordId]
  );
  return result.rows[0] || null;
};

// fetch all pending approvals
const mapApprovalRow = (row) => {
  const fullName = [row.firstname, row.lastname].filter(Boolean).join(" ").trim();
  const normalizedType = normalizeRecordTypeKey(row.record_type) ?? row.record_type;

  return {
    approval_id: row.approval_id ?? row.id ?? null,
    record_type: normalizedType,
    record_id: row.record_id,
    status: row.status,
    submitted_by: row.submitted_by,
    submitted_by_name: fullName.length ? fullName : null,
    performed_by: row.performed_by ?? row.performer_userid ?? null,
    performed_by_name: [row.performer_firstname, row.performer_lastname].filter(Boolean).join(' ').trim() || null,
    submitted_at: row.performed_at,
    reason: row.reason,
    metadata: {
      crop: row.crop_id ?? row.yield_crop_id ?? null,
      barangay_id: row.barangay_id ?? row.yield_barangay_id ?? null,
      year: row.year ?? row.yield_year ?? null,
      season: row.season ?? row.yield_season ?? null,
      price_per_kg: row.price_per_kg ?? null,
      total_yield: row.total_yield ?? null,
    },
  };
};

const STATUS_FILTERS = new Set(["pending", "approved", "rejected"]);

export const fetchApprovalsService = async ({ recordType, status = "pending", searchTerm } = {}) => {
  const params = [];
  const whereClauses = [];

  if (status) {
    const statusValue = status.toLowerCase();
    if (statusValue !== "all" && STATUS_FILTERS.has(statusValue)) {
      whereClauses.push(`LOWER(a.status::text) = $${params.length + 1}`);
      params.push(statusValue);
    }
  }

  if (recordType !== undefined && recordType !== null) {
    const rawType = String(recordType).trim();
    const loweredType = rawType.toLowerCase();

    if (!["", "all", "any"].includes(loweredType)) {
      const normalizedType = normalizeRecordTypeKey(rawType);
      if (!normalizedType) {
        return [];
      }

      const dbRecordType = resolveDbRecordType(normalizedType);
      whereClauses.push(`LOWER(a.record_type::text) = $${params.length + 1}`);
      params.push(dbRecordType.toLowerCase());
    }
  }

  if (searchTerm?.trim()) {
    const search = `%${searchTerm.trim().toLowerCase()}%`;
    const paramIndex = params.length + 1;
    params.push(search);
    whereClauses.push(`(
      CAST(a.record_id AS TEXT) ILIKE $${paramIndex} OR
      LOWER(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')) ILIKE $${paramIndex}
    )`);
  }

  const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const result = await pool.query(
    `SELECT 
       a.*,
       u.firstname,
       u.lastname,
       performer.userid AS performer_userid,
       performer.firstname AS performer_firstname,
       performer.lastname AS performer_lastname,
       cp.crop_id,
       cp.barangay_id,
       cp.price_per_kg,
       cp.year,
       cp.season,
       byld.crop_id AS yield_crop_id,
       byld.barangay_id AS yield_barangay_id,
       byld.year AS yield_year,
       byld.season AS yield_season,
       byld.total_yield
     FROM approvals a
     LEFT JOIN users u ON u.userid = a.submitted_by
     LEFT JOIN users performer ON performer.userid = a.performed_by
     LEFT JOIN barangay_crop_prices cp 
       ON LOWER(a.record_type::text) IN ('crop_prices', 'barangay_crop_prices')
       AND CAST(cp.price_id AS TEXT) = CAST(a.record_id AS TEXT)
     LEFT JOIN barangay_yields byld 
       ON LOWER(a.record_type::text) IN ('barangay_yields', 'barangay_yield')
       AND CAST(byld.yield_id AS TEXT) = CAST(a.record_id AS TEXT)
     ${whereSQL}
     ORDER BY a.performed_at DESC`,
    params
  );

  return result.rows.map(mapApprovalRow);
};
