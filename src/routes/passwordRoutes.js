import express from "express";
import { changePassword } from "../controllers/passwordController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { changePasswordValidation } from "../validators/passwordValidator.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = express.Router();

router.post(
  "/change",
  authenticate,
  changePasswordValidation,
  validateRequest,
  changePassword
);

export default router;
