import pool from '../config/db.js';

// fetch all barangay crop prices
const fetchAllBarangayCropPricesService = async () => {
  const result = await pool.query('SELECT * FROM barangay_crop_prices');
  return result.rows;
}

// fetch barangay crop price by id
const fetchBarangayCropPriceByIdService = async (id) => {
  const result = await pool.query('SELECT * FROM barangay_crop_prices WHERE price_id = $1', [id]);
  return result.rows[0];
}

// add barangay crop price
const addBarangayCropPriceService = async (
  barangay_id, crop_id, price_per_kg, year, season, recorded_by_user_id
) => {
  const result = await pool.query(
    `INSERT INTO barangay_crop_prices 
      (barangay_id, crop_id , price_per_kg, year, season, recorded_by_user_id, date_recorded) 
     VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
     RETURNING *`,
    [barangay_id, crop_id, price_per_kg, year, season, recorded_by_user_id]
  );
  return result.rows[0];
}

// update barangay crop price
const updateBarangayCropPriceService = async (
    price_id, price_per_kg, year, season, barangay_id, crop_id
) => {
    const result = await pool.query(`UPDATE barangay_crop_prices SET 
      price_per_kg = COALESCE($1, price_per_kg),
      year = COALESCE($2, year),
      season = COALESCE($3, season),
      barangay_id = COALESCE($4, barangay_id),
      crop_id = COALESCE($5, crop_id)
    WHERE price_id = $6
    RETURNING *`,
    [price_per_kg, year, season, barangay_id, crop_id, price_id]
  );
  return result.rows[0];
}

//delete barangay crop price
const deleteBarangayCropPriceService = async (price_id) => {
  const result = await pool.query(
    `DELETE FROM barangay_crop_prices WHERE price_id = $1 RETURNING *`,
    [price_id]
  );
  return result.rows[0];
}

const barangayCropPriceService = {
  fetchAllBarangayCropPricesService,
  fetchBarangayCropPriceByIdService,   
  addBarangayCropPriceService,
  updateBarangayCropPriceService,
  deleteBarangayCropPriceService
}

export default barangayCropPriceService;
