import pool from "../config/db.js";

const composeStatusFilter = (status) => {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : null;
  const values = [];
  const conditions = [];

  if (normalized && normalized !== "all") {
    values.push(normalized);
    conditions.push(`LOWER(by.status::text) = LOWER($${values.length})`);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

//  fetch all barangay yield records with names
export const fetchBarangayYieldsService = async ({ status } = {}) => {
  const { clause, values } = composeStatusFilter(status);

  const query = `
    SELECT 
      by.yield_id, 
      by.barangay_id, 
      by.crop_id, 
      by.year, 
      by.month,
      by.season, 
      by.total_yield, 
      by.total_area_planted_ha AS area, 
      by.yield_per_hectare,
      by.status,
      by.recorded_by_user_id,
      c.crop_name AS crop,
      b.adm3_en AS barangay
    FROM barangay_yields by
    JOIN crops c ON by.crop_id = c.crop_id
    JOIN barangays b ON by.barangay_id = b.barangay_id
    ${clause}
    ORDER BY by.yield_id DESC
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

export const fetchBarangayYieldsByUserService = async (userId, { status } = {}) => {
  const { clause, values } = composeStatusFilter(status);
  const whereClause = clause
    ? `${clause} AND by.recorded_by_user_id = $${values.length + 1}`
    : "WHERE by.recorded_by_user_id = $1";

  const query = `
    SELECT 
      by.yield_id, 
      by.barangay_id, 
      by.crop_id, 
      by.year, 
      by.month,
      by.season, 
      by.total_yield, 
      by.total_area_planted_ha AS area, 
      by.yield_per_hectare,
      by.status,
      by.recorded_by_user_id,
      c.crop_name AS crop,
      b.adm3_en AS barangay
    FROM barangay_yields by
    JOIN crops c ON by.crop_id = c.crop_id
    JOIN barangays b ON by.barangay_id = b.barangay_id
    ${whereClause}
    ORDER BY by.yield_id DESC
  `;

  const result = await pool.query(query, [...values, userId]);
  return result.rows;
};

// get barangay yield records by id
const fetchBarangayYieldByIdService = async (yield_id) => {
  const result = await pool.query(
    `SELECT 
       by.*, 
       c.crop_name AS crop, 
       b.adm3_en AS barangay
     FROM barangay_yields by
     JOIN crops c ON by.crop_id = c.crop_id
     JOIN barangays b ON by.barangay_id = b.barangay_id
     WHERE by.yield_id = $1`,
    [yield_id]
  );
  return result.rows[0];
};


/// add barangay yield records service
const addBarangayYieldService = async (
  barangay_id,
  crop_id,
  year,
  month,
  season,
  total_yield,
  total_area_planted_ha,
  yield_per_hectare,
  recorded_by_user_id
) => {
  // Insert new barangay yield record with status = pending
  const result = await pool.query(
    `INSERT INTO barangay_yields 
      (barangay_id, crop_id, year, month, season, total_yield, total_area_planted_ha, yield_per_hectare, recorded_by_user_id, status) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending') 
     RETURNING *`,
    [
      barangay_id,
      crop_id,
      year,
      month,
      season,
      total_yield,
      total_area_planted_ha,
      yield_per_hectare,
      recorded_by_user_id
    ]
  );

  const newYield = result.rows[0];

  // Insert corresponding approval record (pending)
  await pool.query(
    `INSERT INTO approvals (record_type, record_id, status, submitted_by, performed_by, reason)
     VALUES ($1, $2, 'pending', $3, NULL, 'Awaiting review')`,
    ['barangay_yields', newYield.yield_id, recorded_by_user_id]
  );

  return newYield;
};


// update barangay yield record service
const updateBarangayYieldService = async (
  yield_id,
  barangay_id,
  crop_id,
  year,
  month,
  season,
  total_yield,
  total_area_planted_ha,
  yield_per_hectare
) => {
  const result = await pool.query(
    `UPDATE barangay_yields
     SET barangay_id = $1,
         crop_id = $2,
         year = $3,
         month = $4,
         season = $5,
         total_yield = $6,
         total_area_planted_ha = $7,
         yield_per_hectare = $8
     WHERE yield_id = $9
     RETURNING *`,
    [barangay_id, crop_id, year, month, season, total_yield, total_area_planted_ha, yield_per_hectare, yield_id]
  );
  return result.rows[0];
};

// delete barangay yield record service
const deleteBarangayYieldService = async (yield_id) => {
  const result = await pool.query(
    `DELETE FROM barangay_yields WHERE yield_id = $1 RETURNING *`,
    [yield_id]
  );
  return result.rows[0]; 
};

const barangayYieldService = {
  fetchBarangayYieldsService,
  fetchBarangayYieldsByUserService,
  fetchBarangayYieldByIdService,
  addBarangayYieldService,
  updateBarangayYieldService,
  deleteBarangayYieldService,
};


export default barangayYieldService;
