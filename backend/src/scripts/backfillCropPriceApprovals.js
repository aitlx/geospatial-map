import pool from "../config/db.js";
import { insertPendingApproval } from "../utils/approvalUtils.js";

const fetchRecordsMissingApprovals = async () => {
  const { rows } = await pool.query(
    `SELECT price_id, recorded_by_user_id
       FROM barangay_crop_prices cp
      WHERE NOT EXISTS (
        SELECT 1
          FROM approvals a
         WHERE a.record_type::text IN ('crop_prices', 'barangay_crop_prices')
           AND CAST(a.record_id AS TEXT) = CAST(cp.price_id AS TEXT)
      )`
  );

  return rows;
};

const ensurePendingStatus = async (priceId) => {
  await pool.query(
    `UPDATE barangay_crop_prices
        SET status = 'pending'
      WHERE price_id = $1`,
    [priceId]
  );
};

const run = async () => {
  try {
    console.log("Backfilling barangay crop price approvals...");
    const candidates = await fetchRecordsMissingApprovals();

    let count = 0;
    for (const candidate of candidates) {
      await ensurePendingStatus(candidate.price_id);
      await insertPendingApproval("crop_prices", candidate.price_id, candidate.recorded_by_user_id ?? null);
      count += 1;
    }

    console.log(`Approvals created: ${count}`);
  } catch (err) {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
