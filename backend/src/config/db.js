import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Function to pick environment variables or use a fallback
const pickEnv = (names, fallback) =>
    names.map((n) => process.env[n]).find((v) => v !== undefined) ?? fallback;

// Configuration for the database connection
const config = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
    }
    : {
        user: pickEnv(['DB_USER', 'PG_USER', 'PGUSER']),
        host: pickEnv(['DB_HOST', 'PG_HOST', 'PGHOST'], 'localhost'),
        database: pickEnv(['DB_NAME', 'PG_DATABASE', 'PGDATABASE']),
        password: pickEnv(['DB_PASSWORD', 'PG_PASSWORD', 'PGPASSWORD']),
        port: parseInt(pickEnv(['DB_PORT', 'PG_PORT', 'PGPORT'], '5432'), 10),
        ssl: isProduction ? { rejectUnauthorized: false } : false,
    };

const pool = new pg.Pool(config);

pool.on('connect', () => {
    console.log('Database connection pool established');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
});

// Quick startup test to surface connection problems early
(async () => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('Database test query succeeded');
    } catch (err) {
        console.error('Database connection test failed:', err?.message || err);
    }
})();

export default pool;
