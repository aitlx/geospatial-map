import pool from "../config/db.js";
import { insertPendingApproval } from "../utils/approvalUtils.js";

const composeStatusFilter = (alias, status) => {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : null;
  const values = [];
  const conditions = [];

  if (normalized && normalized !== "all") {
    values.push(normalized);
    conditions.push(`LOWER(${alias}.status::text) = LOWER($${values.length})`);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

// fetch all barangay crop prices
const fetchAllBarangayCropPricesService = async ({ status } = {}) => {
  const { clause, values } = composeStatusFilter("bcp", status);

  const query = `
    SELECT
      bcp.price_id,
      bcp.barangay_id,
      bcp.crop_id,
      bcp.price_per_kg,
      bcp.year,
      bcp.month,
      bcp.season,
      bcp.status,
      bcp.recorded_by_user_id,
      bcp.date_recorded,
      b.adm3_en AS barangay_name,
      json_build_object('id', c.crop_id, 'name', c.crop_name) AS crop
    FROM barangay_crop_prices bcp
    LEFT JOIN barangays b ON b.barangay_id = bcp.barangay_id
    LEFT JOIN crops c ON c.crop_id = bcp.crop_id
    ${clause}
    ORDER BY bcp.date_recorded DESC NULLS LAST, bcp.price_id DESC
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const fetchBarangayCropPricesByUserService = async (userId, { status } = {}) => {
  const { clause, values } = composeStatusFilter("bcp", status);

  const whereClause = clause
    ? `${clause} AND bcp.recorded_by_user_id = $${values.length + 1}`
    : "WHERE bcp.recorded_by_user_id = $1";

  const query = `
    SELECT
      bcp.price_id,
      bcp.barangay_id,
      bcp.crop_id,
      bcp.price_per_kg,
      bcp.year,
      bcp.month,
      bcp.season,
      bcp.status,
      bcp.recorded_by_user_id,
      bcp.date_recorded,
      b.adm3_en AS barangay_name,
      json_build_object('id', c.crop_id, 'name', c.crop_name) AS crop
    FROM barangay_crop_prices bcp
    LEFT JOIN barangays b ON b.barangay_id = bcp.barangay_id
    LEFT JOIN crops c ON c.crop_id = bcp.crop_id
    ${whereClause}
    ORDER BY bcp.date_recorded DESC NULLS LAST, bcp.price_id DESC
  `;

  const result = await pool.query(query, [...values, userId]);
  return result.rows;
};

// fetch barangay crop price by id
const fetchBarangayCropPriceByIdService = async (id) => {
  const result = await pool.query('SELECT * FROM barangay_crop_prices WHERE price_id = $1', [id]);
  return result.rows[0];
}

// add barangay crop price
const addBarangayCropPriceService = async (
  barangay_id,
  crop_id,
  price_per_kg,
  year,
  month,
  season,
  recorded_by_user_id
) => {
  const result = await pool.query(
    `INSERT INTO barangay_crop_prices 
      (barangay_id, crop_id , price_per_kg, year, month, season, recorded_by_user_id, status, date_recorded) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW()) 
     RETURNING *`,
    [barangay_id, crop_id, price_per_kg, year, month, season, recorded_by_user_id]
  );
  const newPrice = result.rows[0];

  await insertPendingApproval("crop_prices", newPrice.price_id, recorded_by_user_id ?? null);

  return newPrice;
}

// update barangay crop price
const updateBarangayCropPriceService = async (
    price_id,
    price_per_kg,
    year,
    month,
    season,
    barangay_id,
    crop_id
) => {
    const result = await pool.query(`UPDATE barangay_crop_prices SET 
      price_per_kg = COALESCE($1, price_per_kg),
      year = COALESCE($2, year),
      month = COALESCE($3, month),
      season = COALESCE($4, season),
      barangay_id = COALESCE($5, barangay_id),
      crop_id = COALESCE($6, crop_id)
    WHERE price_id = $7
    RETURNING *`,
    [price_per_kg, year, month, season, barangay_id, crop_id, price_id]
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
  fetchBarangayCropPricesByUserService,
  fetchBarangayCropPriceByIdService,
  addBarangayCropPriceService,
  updateBarangayCropPriceService,
  deleteBarangayCropPriceService,
};

export default barangayCropPriceService;
