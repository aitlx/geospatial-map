import multer from "multer";
import path from "path";
import { handleResponse } from "../utils/handleResponse.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mimetype = (file.mimetype || "").toLowerCase();

  const isAllowed = ALLOWED_EXTENSIONS.has(ext) && ALLOWED_MIME_TYPES.has(mimetype);

  if (isAllowed) {
    return cb(null, true);
  }

  return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
};

const baseUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

const formatUploadErrorMessage = (error) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return "File too large. Maximum allowed size is 5MB.";
      case "LIMIT_UNEXPECTED_FILE":
        return "Invalid file type. Allowed formats: JPG, JPEG, PNG, GIF, WEBP.";
      default:
        return error.message || "Upload failed. Please try again.";
    }
  }

  return error?.message || "Upload failed. Please try again.";
};

export const upload = baseUpload;

export const uploadProfileImage = (req, res, next) => {
  baseUpload.single("profileimg")(req, res, (err) => {
    if (err) {
      const message = formatUploadErrorMessage(err);
      return handleResponse(res, 400, message);
    }

    next();
  });
};
