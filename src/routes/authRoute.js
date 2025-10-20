import express from "express";
import { loginValidation } from "../validators/authValidator.js";
import {
  loginUser,
  loginAdmin,
  logoutUser,
  forgotPassword,
  verifyResetCode,
  resetPassword,
} from "../controllers/authController.js";
import {
  sendVerificationCode,
  verifyEmailWithCode,
  resendVerificationLinkLegacy,
  verifyEmailByTokenController,
} from "../controllers/verifyEmailController.js";

const router = express.Router();

// Auth routes
router.post("/login", loginValidation, loginUser); // Login user
router.post("/admin/login", loginValidation, loginAdmin); // Admin login
router.post("/logout", logoutUser); // Logout user


// Email verification routes
router.post("/send-code", sendVerificationCode); // Send verification code via POST
router.get("/send-code", sendVerificationCode); // Send verification code via GET (legacy)
router.post("/send-link", sendVerificationCode); // Send verification link (POST)
router.get("/send-link", sendVerificationCode); // Send verification link (GET, legacy)
router.patch("/verify-code", verifyEmailWithCode); // Verify email with code
// Token-based verification link (legacy and manual link opens)
router.get("/verify", verifyEmailByTokenController);
router.get("/verify-token", verifyEmailByTokenController);

// Password reset routes
router.post("/forgot-password", forgotPassword); // Request password reset
router.patch("/verify-reset-code", verifyResetCode); // Verify reset code
router.patch("/reset-password", resetPassword); // Reset password

// Legacy resend route
router.get("/resend-code/:id", resendVerificationLinkLegacy); // Legacy resend verification code route

export default router;
