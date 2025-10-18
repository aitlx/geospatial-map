import path from 'path'
import fs from 'fs-extra'
import backupService from '../services/backupService.js'
import { handleResponse } from '../utils/handleResponse.js'
import pool from '../config/db.js'

const BACKUP_DIR = path.resolve(process.cwd(), 'backups')

export const createManualBackup = async (req, res) => {
  const { type = 'manual' } = req.body || {}
  try {
    // create SQL dump
    const { sqlPath, outArchive, baseName } = await backupService.createDatabaseBackup(type)

    // compress
    const result = await backupService.compressBackup(sqlPath, outArchive)

    // file size in MB
    const stat = await fs.stat(outArchive)
    const sizeMb = Number((stat.size / (1024 * 1024)).toFixed(2))

    // save log
    await backupService.saveBackupLog(type, path.basename(outArchive), sizeMb, 'completed')

    // cleanup SQL
    await fs.remove(sqlPath).catch(() => null)

    return handleResponse(res, 200, 'backup created', { filename: path.basename(outArchive), sizeMb, bytes: result.bytes })
  } catch (err) {
    console.error('createManualBackup error:', err)
    // attempt to save failed log
    try { await backupService.saveBackupLog(type, `failed_${Date.now()}.tar.gz`, null, 'failed', String(err?.message || err)) } catch {}
    return handleResponse(res, 500, 'failed to create backup')
  }
}

export const getAllBackups = async (req, res) => {
  try {
    const items = await backupService.listAllBackups()
    return handleResponse(res, 200, 'ok', items)
  } catch (err) {
    console.error('getAllBackups error:', err)
    return handleResponse(res, 500, 'failed to list backups')
  }
}

export const downloadBackup = async (req, res) => {
  const { filename } = req.params || {}
  if (!filename) return handleResponse(res, 400, 'filename required')

  const p = path.join(BACKUP_DIR, filename)
  try {
    if (!await fs.pathExists(p)) return handleResponse(res, 404, 'file not found')
    return res.download(p)
  } catch (err) {
    console.error('downloadBackup error:', err)
    return handleResponse(res, 500, 'failed to download backup')
  }
}

// Download by backup record id: looks up DB record then serves the file
export const downloadBackupById = async (req, res) => {
  const { id } = req.params || {}
  if (!id) return handleResponse(res, 400, 'id required')

  try {
    const record = await backupService.getBackupById(id)
    if (!record) return handleResponse(res, 404, 'backup not found')

    const p = path.join(BACKUP_DIR, record.filename)
    if (!await fs.pathExists(p)) return handleResponse(res, 404, 'file not found')
    return res.download(p)
  } catch (err) {
    console.error('downloadBackupById error:', err)
    return handleResponse(res, 500, 'failed to download backup')
  }
}

export const deleteBackup = async (req, res) => {
  const { id } = req.params || {}
  if (!id) return handleResponse(res, 400, 'id required')

  try {
    const record = await backupService.getBackupById(id)
    if (!record) return handleResponse(res, 404, 'backup not found')

    // delete file
    try {
      await backupService.deleteBackupFile(record.filename)
    } catch (err) {
      console.warn('deleteBackup: failed to delete file', err?.message || err)
    }

    // delete DB record
    try {
      await pool.query(`DELETE FROM backup_logs WHERE id = $1`, [id])
    } catch (err) {
      console.warn('deleteBackup: failed to delete DB record', err?.message || err)
    }

    return handleResponse(res, 200, 'backup deleted')
  } catch (err) {
    console.error('deleteBackup error:', err)
    return handleResponse(res, 500, 'failed to delete backup')
  }
}

export const uploadBackup = async (req, res) => {
  // Entry logging
  console.log('uploadBackup: entered', { user: req.user?.id ?? null })

  if (!req.file) {
    console.error('uploadBackup: no file attached on request')
    return handleResponse(res, 400, 'Please attach a backup file to upload.')
  }

  const { originalname, filename, mimetype, size, path: tmpPath } = req.file

  console.log('uploadBackup: received file', { originalname, filename, mimetype, size, tmpPath })

  const destDir = path.resolve(process.cwd(), 'backups')
  await fs.ensureDir(destDir)
  const destPath = path.join(destDir, filename)

  try {
    await fs.move(tmpPath, destPath, { overwrite: true })
    console.log('uploadBackup: moved file to', destPath)
  } catch (moveErr) {
    console.error('uploadBackup: fs.move failed', { tmpPath, destPath, error: moveErr?.message })
    console.error(moveErr?.stack || moveErr)
    // Attempt to cleanup tmp if present
    try { if (tmpPath && await fs.pathExists(tmpPath)) await fs.remove(tmpPath) } catch (e) { /* ignore */ }
    return handleResponse(res, 500, 'failed to move uploaded file')
  }

  let sizeMb = null
  try {
    const stat = await fs.stat(destPath)
    sizeMb = Number((stat.size / (1024 * 1024)).toFixed(2))
  } catch (statErr) {
    console.warn('uploadBackup: fs.stat failed', { destPath, error: statErr?.message })
  }

  // Try saving to DB; if it fails, undo moved file and return an error so caller knows upload did NOT fully succeed
  try {
    // Use 'manual' to match the backup_type_enum values in the DB
    const record = await backupService.saveBackupLog('manual', filename, sizeMb, 'completed')
    console.log('uploadBackup: saveBackupLog succeeded', { id: record?.id ?? null })
    return handleResponse(res, 201, 'uploaded', record)
  } catch (dbErr) {
    console.error('uploadBackup: saveBackupLog failed', dbErr?.message)
    console.error(dbErr?.stack || dbErr)

    // Attempt to remove the file we moved to avoid inconsistency between filesystem and DB
    try {
      if (await fs.pathExists(destPath)) {
        await fs.remove(destPath)
        console.log('uploadBackup: cleaned up moved file after DB failure', destPath)
      }
    } catch (cleanupErr) {
      console.warn('uploadBackup: failed to cleanup moved file after DB failure', cleanupErr?.message)
    }

    return handleResponse(res, 500, 'failed to record uploaded backup')
  }
}

export default {
  createManualBackup,
  getAllBackups,
  downloadBackup,
  deleteBackup,
  uploadBackup,
}

