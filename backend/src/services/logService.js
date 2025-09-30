import pool from '../config/db.js';
import { sanitizaDetails } from '../utils/sanitizaDetails.js';

export const logService = {
    async add({ userId, roleId, action, targetTable, targetId, details })  {
        const safeDetails = sanitizaDetails(details);

        await pool.query(
            `INSERT INTO logs (user_id, role_id, action, target_table, target_id, details, logged_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [userId, roleId, action, targetTable, targetId, safeDetails]
        );
    }, 

  async findAll() {
    const result = await pool.query(
      `SELECT 
        l.log_id,
        l.action,
        l.target_table,
        l.target_id,
        l.details,
        l.logged_at,
        u.firstname || ' ' || u.lastname AS actor,
        u.roleid
       FROM logs l
       LEFT JOIN users u ON u.userid = l.user_id
       ORDER BY l.logged_at DESC`
    );
    return result.rows;
  },

  async findByUser(userId) {
    const result = await pool.query(
      `SELECT 
        log_id,
        action,
        target_table,
        target_id,
        details,
        logged_at
       FROM logs
       WHERE user_id = $1
       ORDER BY logged_at DESC`,
      [userId]
    );
    return result.rows;
  },
};

