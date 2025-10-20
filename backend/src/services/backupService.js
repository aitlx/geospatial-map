import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import archiver from 'archiver'
import pool from '../config/db.js'

const execFileAsync = promisify(execFile)

const BACKUP_DIR = path.resolve(process.cwd(), 'backups')

async function ensureBackupDir() {
  await fs.ensureDir(BACKUP_DIR)
}

function timestampForFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`
}

export async function createDatabaseBackup(backupType = 'manual') {
  await ensureBackupDir()

  const ts = timestampForFilename()
  const baseName = `geoagri_${backupType}_${ts}`
  const sqlPath = path.join(BACKUP_DIR, `${baseName}.sql`)
  const outArchive = path.join(BACKUP_DIR, `${baseName}.tar.gz`)

  // Build pg_dump args from environment or use defaults
  const dbUrl = process.env.DATABASE_URL || null
  try {
    // If DATABASE_URL provided, use pg_dump with connection string
    const args = []
    if (dbUrl) {
      args.push(dbUrl)
    } else {
      const user = process.env.PGUSER || process.env.PG_USER || 'postgres'
      const host = process.env.PGHOST || 'localhost'
      const port = process.env.PGPORT || '5432'
      const db = process.env.PGDATABASE || process.env.PG_DB || 'postgres'
      args.push(`-U`, user, `-h`, host, `-p`, port, `-F`, `p`, `-f`, sqlPath, db)
    }

    // If DATABASE_URL is provided we need to instruct pg_dump to output to file
    if (dbUrl) {
      // pg_dump <connection-string> -f file.sql
      args.push(`-f`, sqlPath)
    }

    // Execute pg_dump. Assumes pg_dump is available in PATH.
    await execFileAsync('pg_dump', args, { env: process.env })

    return { sqlPath, outArchive, baseName }
  } catch (err) {
    // clean up sqlPath if partially created
    try { await fs.remove(sqlPath) } catch {}
    throw err
  }
}

export async function compressBackup(sqlPath, outArchive) {
  await ensureBackupDir()
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outArchive)
    const archive = archiver('tar', { gzip: true })

    output.on('close', () => resolve({ bytes: archive.pointer() }))
    archive.on('error', (err) => reject(err))

    archive.pipe(output)
    archive.file(sqlPath, { name: path.basename(sqlPath) })
    archive.finalize()
  })
}

export async function saveBackupLog(backupType, filename, fileSizeMb = null, status = 'completed', errorMessage = null) {
  const q = `INSERT INTO backup_logs (backup_type, filename, file_size_mb, backup_status, error_message, created_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`
  const vals = [backupType, filename, fileSizeMb, status, errorMessage]
  const res = await pool.query(q, vals)
  return res.rows[0]
}

export async function listAllBackups() {
  const q = `SELECT * FROM backup_logs ORDER BY created_at DESC`
  const res = await pool.query(q)
  return res.rows
}

export async function getBackupById(id) {
  const q = `SELECT * FROM backup_logs WHERE id = $1 LIMIT 1`
  const res = await pool.query(q, [id])
  return res.rows[0]
}

export async function deleteBackupFile(filename) {
  const p = path.join(BACKUP_DIR, filename)
  await fs.remove(p)
}

export async function deleteOldBackups(backupType = null, keepCount = 5) {
  // Select backups to delete
  let q = `SELECT id, filename FROM backup_logs`
  const vals = []
  if (backupType) {
    q += ` WHERE backup_type = $1`
    vals.push(backupType)
  }
  q += ` ORDER BY created_at DESC`

  const res = await pool.query(q, vals)
  const toKeep = res.rows.slice(0, keepCount).map(r => r.id)
  const toDelete = res.rows.slice(keepCount)

  for (const r of toDelete) {
    try {
      await deleteBackupFile(r.filename)
    } catch (err) {
      console.warn('deleteOldBackups: failed to remove file', r.filename, err?.message || err)
    }
    try {
      await pool.query(`DELETE FROM backup_logs WHERE id = $1`, [r.id])
    } catch (err) {
      console.warn('deleteOldBackups: failed to remove db record', r.id, err?.message || err)
    }
  }

  return { deleted: toDelete.map(r => r.id).length }
}

export default {
  createDatabaseBackup,
  compressBackup,
  saveBackupLog,
  listAllBackups,
  deleteOldBackups,
  getBackupById,
  deleteBackupFile,
}

