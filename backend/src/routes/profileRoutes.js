import express from "express";
import { updateProfile } from "../controllers/profileController.js";
import { upload } from "../middleware/uploadMiddleware.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// endpoint to edit profile
router.put(
  "/update",
  authenticate,           // check user is logged in
  upload.single("profileimg"), // handle profile image upload
  updateProfile             // controller
);

export default router;