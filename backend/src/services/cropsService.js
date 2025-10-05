import pool from "../config/db.js";

// Fetch all crops
const fetchAllCropsService = async () => {
  const result = await pool.query(
    `SELECT *
     FROM crops
     ORDER BY crop_name ASC`
  );
  return result.rows;
};

// Fetch crop by ID
const fetchCropByIdService = async (id) => {
  const result = await pool.query("SELECT * FROM crops WHERE crop_id = $1", [id]);
  return result.rows[0];
};

// add crop service
const addCropService = async (crop_name, category = null) => {
  const result = await pool.query(
    `INSERT INTO crops 
      (crop_name, category) 
     VALUES ($1, $2) 
     RETURNING *`,
    [crop_name, category]
  );
  return result.rows[0];
};

// update crop with dynamic fields
const updateCropService = async (crop_id, updates = {}) => {
  const fields = [];
  const values = [];
  let index = 1;

  if (Object.prototype.hasOwnProperty.call(updates, "crop_name")) {
    fields.push(`crop_name = $${index}`);
    values.push(updates.crop_name);
    index += 1;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "category")) {
    fields.push(`category = $${index}`);
    values.push(updates.category);
    index += 1;
  }

  if (!fields.length) {
    return null;
  }

  values.push(crop_id);

  const result = await pool.query(
    `UPDATE crops
       SET ${fields.join(", ")}
     WHERE crop_id = $${index}
     RETURNING *`,
    values
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