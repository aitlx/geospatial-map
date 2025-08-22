import pool from "../config/db.js";

// Fetch all crops
const fetchAllCropsService = async () => {
  const result = await pool.query("SELECT * FROM crops");
  return result.rows;
};

// Fetch crop by ID
const fetchCropByIdService = async (id) => {
  const result = await pool.query("SELECT * FROM crops WHERE crop_id = $1", [id]);
  return result.rows[0];
};

// add crop service
const addCropService = async (
 crop_name,
 category, 
 planting_season
) => {
  const result = await pool.query(
    `INSERT INTO crops 
      (crop_name, category, planting_season) 
     VALUES ($1, $2, $3) 
     RETURNING *`,
    [crop_name, category, planting_season]
  );
  return result.rows[0];
};

// update crop
const updateCropService = async (
    crop_id,
 crop_name,
 category, 
 planting_season
) => {
  const result = await pool.query(
    `UPDATE crops SET 
      crop_name = $1,
      category = $2,
      planting_season = $3
    WHERE crop_id = $4
    RETURNING *`,
    [crop_name, category, planting_season, crop_id]
  );
  return result.rows[0];
};

// delete crop
const deleteCropService = async (crop_id) => {
  const result = await pool.query(
    `DELETE FROM crops WHERE crop_id = $1 RETURNING *`,
    [crop_id]
  );
  return result.rows[0];
};

const cropService = {
  fetchAllCropsService,
  fetchCropByIdService,
  addCropService,
  updateCropService,
  deleteCropService,
};


export default cropService;