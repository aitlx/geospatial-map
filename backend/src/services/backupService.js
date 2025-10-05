import fs from "fs/promises"
import path from "path"
import pool from "../config/db.js"

const BACKUP_DIRECTORY = path.resolve("uploads/backups")

const normalizeStoragePath = (filePath) => {
  if (!filePath) return null
  const absolute = path.resolve(filePath)
  return path.relative(process.cwd(), absolute)
}

const resolveAbsolutePath = (storedPath, fallbackName) => {
  if (storedPath) {
    return path.resolve(process.cwd(), storedPath)
  }
  if (!fallbackName) {
    return null
  }
  return path.join(BACKUP_DIRECTORY, fallbackName)
}

const safeUnlink = async (filePath) => {
  if (!filePath) return
  try {
    await fs.unlink(filePath)
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error(`failed to remove backup file ${filePath}`, error)
    }
  }
}

export const backupService = {
  async list() {
    const result = await pool.query(
      `SELECT
         b.backup_id,
         b.filename,
         b.original_filename,
         b.file_size,
         b.mime_type,
         b.storage_path,
         b.created_by,
         b.created_at,
         b.notes,
         u.firstname || ' ' || u.lastname AS created_by_name,
         u.email AS created_by_email
       FROM backups b
       LEFT JOIN users u ON u.userid = b.created_by
       ORDER BY b.created_at DESC`
    )

    return result.rows
  },

  async create({ filename, originalName, fileSize, mimeType, storagePath, createdBy, notes }) {
    const result = await pool.query(
      `INSERT INTO backups (
         filename,
         original_filename,
         file_size,
         mime_type,
         storage_path,
         created_by,
         notes,
         created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING backup_id, filename, original_filename, file_size, mime_type, storage_path, created_by, created_at, notes`,
      [
        filename,
        originalName,
        fileSize,
        mimeType,
        normalizeStoragePath(storagePath),
        createdBy,
        notes || null,
      ]
    )

    return result.rows[0]
  },

  async findById(id) {
    const result = await pool.query(
      `SELECT
         b.backup_id,
         b.filename,
         b.original_filename,
         b.file_size,
         b.mime_type,
         b.storage_path,
         b.created_by,
         b.created_at,
         b.notes,
         u.firstname || ' ' || u.lastname AS created_by_name,
         u.email AS created_by_email
       FROM backups b
       LEFT JOIN users u ON u.userid = b.created_by
       WHERE b.backup_id = $1`,
      [id]
    )

    return result.rows[0] || null
  },

  async remove(id) {
    const client = await pool.connect()

    try {
      await client.query("BEGIN")

      const existingResult = await client.query(
        `SELECT backup_id, filename, original_filename, storage_path FROM backups WHERE backup_id = $1 FOR UPDATE`,
        [id]
      )

      if (existingResult.rowCount === 0) {
        await client.query("ROLLBACK")
        return null
      }

      const backup = existingResult.rows[0]

      await client.query(`DELETE FROM backups WHERE backup_id = $1`, [id])
      await client.query("COMMIT")

      const absolutePath = resolveAbsolutePath(backup.storage_path, backup.filename)
      await safeUnlink(absolutePath)

      return backup
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  },

  resolveAbsolutePath,
}
