import pool from '../config/db.js';

export const fetchBarangays = async () => {
    const result = await pool.query (
        `SELECT barangay_id, 
        adm3_pcode,
        adm3_en,
        municipality_name,
        ST_AsGeoJSON(geom) AS geometry
        FROM barangays;`
    );
    return result.rows;
};