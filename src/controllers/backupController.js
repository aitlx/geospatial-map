import fs from "fs/promises"
import { backupService } from "../services/backupService.js"
import { handleResponse } from "../utils/handleResponse.js"
import { logService } from "../services/logService.js"

const attemptAudit = async (payload) => {
  try {
    await logService.add(payload)
  } catch (error) {
    console.error("failed to record backup audit log", error)
  }
}

const normalizeBackupId = (rawId) => {
  if (!rawId) return null
  const parsed = Number.parseInt(rawId, 10)
  return Number.isNaN(parsed) ? null : parsed
}

const mapBackupRecord = (record) => {
  if (!record) return null

  return {
    id: record.backup_id,
    fileName: record.filename,
    originalName: record.original_filename,
    size: record.file_size,
    mimeType: record.mime_type,
    storagePath: record.storage_path,
    createdAt: record.created_at,
    notes: record.notes,
    createdBy: record.created_by
      ? {
          id: record.created_by,
          name: record.created_by_name ?? null,
          email: record.created_by_email ?? null,
        }
      : null,
    downloadUrl: record.backup_id ? `/api/backups/${record.backup_id}/download` : null,
  }
}

export const createBackup = async (req, res, next) => {
  try {
    const file = req.file
    if (!file) {
      return handleResponse(res, 400, "Please attach a backup file to upload.")
    }

    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 500) : null
    const createdBy = req.user?.id ?? null

    const backupRecord = await backupService.create({
      filename: file.filename,
      originalName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      storagePath: file.path,
      createdBy,
      notes,
    })

    const fullRecord = await backupService.findById(backupRecord.backup_id)
    const shaped = mapBackupRecord(fullRecord ?? backupRecord)

    await attemptAudit({
      userId: req.user?.id ?? null,
      roleId: req.user?.roleID ?? null,
      action: "BACKUP_UPLOADED",
      targetTable: "backups",
      targetId: backupRecord.backup_id,
      details: {
        summary: "Backup uploaded",
        fileSizeBytes: backupRecord.file_size ?? null,
        hasOriginalFilename: Boolean(backupRecord.original_filename),
        notesIncluded: Boolean(notes),
      },
    })

    return handleResponse(res, 201, "Backup archived successfully.", shaped)
  } catch (error) {
    return next(error)
  }
}

export const listBackups = async (req, res, next) => {
  try {
    const backups = await backupService.list()
    const data = backups.map(mapBackupRecord)
    return handleResponse(res, 200, "Backups fetched successfully.", { results: data })
  } catch (error) {
    return next(error)
  }
}

export const downloadBackup = async (req, res, next) => {
  try {
    const backupId = normalizeBackupId(req.params.id)
    if (backupId === null) {
      return handleResponse(res, 400, "Invalid backup identifier.")
    }

    const record = await backupService.findById(backupId)

    if (!record) {
      return handleResponse(res, 404, "Backup not found.")
    }

    const absolutePath = backupService.resolveAbsolutePath(record.storage_path, record.filename)
    if (!absolutePath) {
      return handleResponse(res, 500, "Backup file path is missing.")
    }

    try {
      await fs.access(absolutePath)
    } catch (error) {
      if (error?.code === "ENOENT") {
        return handleResponse(res, 404, "Backup file is no longer available on the server.")
      }
      throw error
    }

    const downloadName = record.original_filename || record.filename || "municipal-backup"

    res.download(absolutePath, downloadName, async (err) => {
      if (err) {
        return next(err)
      }

      await attemptAudit({
        userId: req.user?.id ?? null,
        roleId: req.user?.roleID ?? null,
        action: "BACKUP_DOWNLOADED",
        targetTable: "backups",
        targetId: record.backup_id,
        details: {
          summary: "Backup downloaded",
          hasOriginalFilename: Boolean(record.original_filename),
          fileSizeBytes: record.file_size ?? null,
        },
      })
    })
  } catch (error) {
    return next(error)
  }
}

export const deleteBackup = async (req, res, next) => {
  try {
    const backupId = normalizeBackupId(req.params.id)
    if (backupId === null) {
      return handleResponse(res, 400, "Invalid backup identifier.")
    }

    const removed = await backupService.remove(backupId)

    if (!removed) {
      return handleResponse(res, 404, "Backup not found.")
    }

    await attemptAudit({
      userId: req.user?.id ?? null,
      roleId: req.user?.roleID ?? null,
      action: "BACKUP_DELETED",
      targetTable: "backups",
      targetId: removed.backup_id,
      details: {
        summary: "Backup deleted",
        hadOriginalFilename: Boolean(removed.original_filename),
        fileSizeBytes: removed.file_size ?? null,
      },
    })

    return handleResponse(res, 200, "Backup deleted successfully.", {
      id: backupId,
      filename: removed.filename,
    })
  } catch (error) {
    return next(error)
  }
}
