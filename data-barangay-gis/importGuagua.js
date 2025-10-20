import fs from 'fs';
import pool from '../src/config/db.js';

console.log('Script started');

// load Guagua GeoJSON
const geojson = JSON.parse(fs.readFileSync('data-barangay-gis/Guagua_barangays.geojson', 'utf8'));
console.log('GeoJSON loaded');

// convert Polygon/MultiPolygon to WKT
function geometryToWKT(geometry) {
  const { type, coordinates } = geometry;

  if (type === 'Polygon') {
    return 'POLYGON((' + coordinates[0].map(c => `${c[0]} ${c[1]}`).join(',') + '))';
  } else if (type === 'MultiPolygon') {
    const polys = coordinates.map(polygon => {
      return '(' + polygon.map(ring => '(' + ring.map(c => `${c[0]} ${c[1]}`).join(',') + ')').join(',') + ')';
    });
    return 'MULTIPOLYGON(' + polys.join(',') + ')';
  } else {
    throw new Error('Unsupported geometry type: ' + type);
  }
}

// insert all Guagua barangays
const insertGuagua = async () => {
  try {
    // test DB connection
    await pool.query('SELECT 1');
    
    for (const feature of geojson.features) {
      const ADM4_PCODE = feature.properties.ADM4_PCODE;
      const ADM4_EN = feature.properties.ADM4_EN;

      if (!feature.geometry) continue; // skip features without geometry

      const wkt = geometryToWKT(feature.geometry);

      await pool.query(
        'INSERT INTO barangays (adm3_pcode, adm3_en, geom) VALUES ($1, $2, ST_GeomFromText($3, 4326))',
        [ADM4_PCODE, ADM4_EN, wkt]
      );
    }

    console.log('All Guagua barangays inserted');
  } catch (err) {
    console.error('Insert error:', err);
  } finally {
    pool.end();
  }
};

insertGuagua();
