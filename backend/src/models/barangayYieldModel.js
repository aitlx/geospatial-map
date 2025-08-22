import pool from "../config/db.js";

//  fetch all barangay yield records with names
export const fetchBarangayYieldsService = async () => {
  const result = await pool.query(`
    SELECT 
      by.yield_id, 
      by.barangay_id, 
      by.crop_id, 
      by.year, 
      by.season, 
      by.total_yield, 
      by.total_area_planted_ha, 
      by.yield_per_hectare,
      c.crop_name,
      b.barangay_name
    FROM barangay_yields by
    JOIN crops c ON by.crop_id = c.crop_id
    JOIN barangays b ON by.barangay_id = b.barangay_id
    ORDER BY by.yield_id DESC
  `);
  return result.rows;
};

// get barangay yield records by id
const fetchBarangayYieldByIdService = async (yield_id) => {
  const result = await pool.query(
    `SELECT by.*, c.crop_name, b.barangay_name
     FROM barangay_yields by
     JOIN crops c ON by.crop_id = c.crop_id
     JOIN barangays b ON by.barangay_id = b.barangay_id
     WHERE by.yield_id = $1`,
    [yield_id]
  );
  return result.rows[0];
};

// add barangay yield records service
const addBarangayYieldService = async (
  barangay_id,
  crop_id,
  year,
  season,
  total_yield,
  total_area_planted_ha,
  yield_per_hectare,
  recorded_by_user_id 
) => {
  const result = await pool.query(
    `INSERT INTO barangay_yields 
      (barangay_id, crop_id, year, season, total_yield, total_area_planted_ha, yield_per_hectare, recorded_by_user_id, status) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') 
     RETURNING *`,
    [
      barangay_id,
      crop_id,
      year,
      season,
      total_yield,
      total_area_planted_ha,
      yield_per_hectare,
      recorded_by_user_id 
    ]
  );

  return result.rows[0];
};

// update barangay yield record service
const updateBarangayYieldService = async (
  yield_id,
  barangay_id,
  crop_id,
  year,
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
         season = $4,
         total_yield = $5,
         total_area_planted_ha = $6,
         yield_per_hectare = $7
     WHERE yield_id = $8
     RETURNING *`,
    [barangay_id, crop_id, year, season, total_yield, total_area_planted_ha, yield_per_hectare, yield_id]
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
  fetchBarangayYieldByIdService,
  addBarangayYieldService,
  updateBarangayYieldService,
  deleteBarangayYieldService,
};


export default barangayYieldService;
