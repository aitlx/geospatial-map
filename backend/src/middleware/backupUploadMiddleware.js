import fs from "fs"
import multer from "multer"
import path from "path"
import { handleResponse } from "../utils/handleResponse.js"

const BACKUP_DIRECTORY = path.resolve("uploads/backups")
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
// Accept SQL dumps and common archive formats used for backups
const ALLOWED_EXTENSIONS = new Set([".sql", ".gz", ".zip", ".tar"])
const ALLOWED_MIME_TYPES = new Set([
  "application/sql",
  "application/x-sql",
  "text/plain",
  "application/octet-stream",
  "application/gzip",
  "application/x-gzip",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-tar",
])

const ensureBackupDirectory = () => {
  if (!fs.existsSync(BACKUP_DIRECTORY)) {
    fs.mkdirSync(BACKUP_DIRECTORY, { recursive: true })
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      ensureBackupDirectory()
      cb(null, BACKUP_DIRECTORY)
    } catch (error) {
      cb(error, BACKUP_DIRECTORY)
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const random = Math.round(Math.random() * 1e9)
    const originalName = file.originalname ?? "backup"
    const extension = path.extname(originalName).toLowerCase()
    const safeBaseName = path
      .basename(originalName, extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "backup"

    cb(null, `${timestamp}-${random}-${safeBaseName}${extension}`)
  },
})

const fileFilter = (req, file, cb) => {
  const original = String(file.originalname || "").toLowerCase()
  const extension = path.extname(original)

  // special-case .tar.gz
  const isTarGz = original.endsWith('.tar.gz')
  if (!isTarGz && !ALLOWED_EXTENSIONS.has(extension)) {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname))
  }

  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    // allow generic octet-stream uploads as long as extension is valid
    if (file.mimetype !== 'application/octet-stream') {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname))
    }
  }

  return cb(null, true)
}

const uploader = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
})

const formatUploadErrorMessage = (error) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return `Backup file is too large. Maximum allowed size is ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB.`
      case 'LIMIT_UNEXPECTED_FILE':
        return 'Unsupported file type. Allowed: .sql, .gz, .tar, .zip (or .tar.gz).'
      default:
        return error.message || 'Upload failed. Please try again.'
    }
  }

  return error?.message || "Upload failed. Please try again."
}

export const uploadBackupFile = (req, res, next) => {
  uploader.single("backupFile")(req, res, (error) => {
    if (error) {
      const message = formatUploadErrorMessage(error)
      return handleResponse(res, 400, message)
    }

    if (!req.file) {
      return handleResponse(res, 400, "Please attach a backup file to upload.")
    }

    return next()
  })
}

export { BACKUP_DIRECTORY }
