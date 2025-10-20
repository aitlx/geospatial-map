import pool from "../config/db.js";
import { sanitizaDetails } from "../utils/sanitizaDetails.js";
import { cleanseVulgarValue, sanitizeLogRecord } from "../utils/sanitizeVulgarity.js";
import { normalizeUserId } from "./userService.js";

export const logService = {
    async add({ userId, roleId, action, targetTable, targetId, details })  {
        const safeDetails = sanitizaDetails(details);
    const safeAction = cleanseVulgarValue(action);
    const safeTargetTable = cleanseVulgarValue(targetTable);
    const safeTargetId = cleanseVulgarValue(targetId);

        await pool.query(
            `INSERT INTO logs (user_id, role_id, action, target_table, target_id, details, logged_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [userId, roleId, safeAction, safeTargetTable, safeTargetId, safeDetails]
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
   return result.rows.map(sanitizeLogRecord);
  },

  async findByUser(userId) {
    const normalizedId = normalizeUserId(userId);
    if (normalizedId === null) {
      return [];
    }

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
        [normalizedId]
      );
      return result.rows.map(sanitizeLogRecord);
  },
};

