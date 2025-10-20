import pool from "../config/db.js";

const RECORD_LABELS = {
  barangay_yields: "Barangay yield record",
  crop_prices: "Crop price record",
};

const normalizeStatus = (status) => {
  if (!status) return "pending";
  const key = status.toLowerCase();
  if (key === "approved") return "verified";
  if (["pending", "verified", "rejected"].includes(key)) return key;
  return "pending";
};

const formatRecordLabel = (recordType) => {
  if (!recordType) return "Record";
  return RECORD_LABELS[recordType] || recordType
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

const buildApprovalNotification = (row) => {
  const status = normalizeStatus(row.status);
  const recordLabel = formatRecordLabel(row.record_type);
  const timestamp = row.performed_at || new Date().toISOString();

  let title = "";
  let message = "";

  if (status === "verified") {
    title = `${recordLabel} verified`;
    message = `An administrator reviewed and verified your ${recordLabel.toLowerCase()}.`;
  } else if (status === "rejected") {
    title = `${recordLabel} rejected`;
    const reasons = row.reason && row.reason !== "N/A" ? row.reason : "Check the details and resubmit with corrections.";
    message = `Your ${recordLabel.toLowerCase()} was rejected. ${reasons}`;
  } else {
    title = `${recordLabel} awaiting review`;
    message = `Your submission is queued for approval. We'll notify you when it's verified.`;
  }

  return {
    id: `approval-${row.record_type}-${row.record_id}-${status}-${Date.parse(timestamp) || Date.now()}`,
    category: "approval",
    status,
    title,
    message,
  timestamp: new Date(timestamp).toISOString(),
    meta: {
      recordType: row.record_type,
      recordId: row.record_id,
      reason: row.reason || null,
      performedBy: row.performed_by || null,
    },
  };
};

export const fetchTechnicianNotifications = async (userId) => {
  const approvalsResult = await pool.query(
    `SELECT 
       record_type,
       record_id,
       status,
       reason,
       submitted_by,
       performed_by,
       performed_at
     FROM approvals
     WHERE submitted_by = $1
     ORDER BY COALESCE(performed_at, NOW()) DESC
     LIMIT 25`,
    [userId]
  );

  const approvals = approvalsResult.rows || [];
  const approvalNotifications = approvals.map(buildApprovalNotification);

  const statsResult = await pool.query(
    `SELECT 
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
       MAX(COALESCE(performed_at, NOW())) AS last_activity
     FROM approvals
     WHERE submitted_by = $1`,
    [userId]
  );

  const stats = statsResult.rows?.[0] || {};
  const pendingCount = Number(stats.pending_count || 0);
  const lastActivityRaw = stats.last_activity ? new Date(stats.last_activity) : null;

  const reminders = [];

  if (!lastActivityRaw || Number.isNaN(lastActivityRaw.valueOf()) || ((Date.now() - lastActivityRaw.getTime()) / (1000 * 60 * 60 * 24)) >= 30) {
    reminders.push({
      id: "reminder-monthly-update",
      category: "reminder",
      status: "reminder",
      title: "Monthly data refresh due",
      message: "It's time to upload the latest barangay yields and market prices to keep dashboards current.",
      timestamp: new Date().toISOString(),
      meta: {
        type: "monthly-refresh",
        lastActivity: lastActivityRaw ? lastActivityRaw.toISOString() : null,
      },
    });
  }

  if (pendingCount > 0) {
    reminders.push({
      id: "reminder-pending-approvals",
      category: "reminder",
      status: "pending",
      title: pendingCount === 1 ? "1 submission awaiting approval" : `${pendingCount} submissions awaiting approval`,
      message: "Admins are reviewing your submissions. You’ll get an update when each one is verified or rejected.",
      timestamp: new Date().toISOString(),
      meta: {
        type: "pending-summary",
        pendingCount,
      },
    });
  }

  const notifications = [...approvalNotifications, ...reminders]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return notifications;
};

export default {
  fetchTechnicianNotifications,
};
