import { fetchBarangays } from "../services/barangayService.js";
import  { handleResponse } from "../utils/handleResponse.js";

// fetch barangays and return as geojson
export const getBarangays = async (req, res) => {
  try {
    const rows = await fetchBarangays();

    // build geojson feature collection
    const geojson = {
      type: "FeatureCollection",
      features: rows.map(row => ({
        type: "Feature",
        properties: {
          id: row.barangay_id,  // use barangay_id instead of generic id
          adm3_pcode: row.adm3_pcode,
          adm3_en: row.adm3_en,
          municipality_name: row.municipality_name
        },
        geometry: JSON.parse(row.geometry) // parse geom into json
      }))
    };

    handleResponse(res, 200, true, geojson, "Barangays fetched successfully");
  } catch (err) {
    console.error("Error fetching barangays:", err);
    handleResponse(res, 500, false, null, "Failed to fetch barangays");
  }
};

export const getBarangayDropdown = async (req, res, next) => {
  try {
    const rows = await fetchBarangays();

    // map to simple array
    const dropdown = rows.map((row) => ({
      id: row.barangay_id,
      name: row.adm3_en,
    }));

    handleResponse(res, 200, true, dropdown, "Barangays fetched for dropdown");
  } catch (err) {
    next(err);
  }
};
