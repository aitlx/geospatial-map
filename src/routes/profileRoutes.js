import express from "express";
import { updateProfile } from "../controllers/profileController.js";
import { uploadProfileImage } from "../middleware/uploadMiddleware.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { handleResponse } from "../utils/handleResponse.js";

const router = express.Router();

router.get("/update", authenticate, (req, res) =>
  handleResponse(res, 200, "profile update endpoint ready", {
    method: "PUT",
    instructions: "Send a PUT request with multipart/form-data to update profile details",
  })
);

// endpoint to edit profile
router.put(
  "/update",
  authenticate,           // check user is logged in
  uploadProfileImage, // handle profile image upload with validation
  updateProfile             // controller
);

export default router;