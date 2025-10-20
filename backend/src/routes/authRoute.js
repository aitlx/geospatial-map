import express from "express";
import { loginValidation } from "../validators/authValidator.js";
import {
  loginUser,
  loginAdmin,
  logoutUser,
} from "../controllers/authController.js";
import { forgotPasswordLink, resetPasswordWithToken } from "../controllers/passwordResetController.js";
import {
  sendVerificationCode,
  verifyEmailWithCode,
  resendVerificationLinkLegacy,
  verifyEmailByTokenController,
} from "../controllers/verifyEmailController.js";

const router = express.Router();

// auth routes
router.post("/login", loginValidation, loginUser); 
router.post("/admin/login", loginValidation, loginAdmin); 
router.post("/logout", logoutUser); 


// email verification routes
router.post("/send-code", sendVerificationCode); // send verification code via POST
router.get("/send-code", sendVerificationCode); // send verification code via GET (legacy)
router.post("/send-link", sendVerificationCode); // send verification link (POST)
router.get("/send-link", sendVerificationCode); // send verification link (GET, legacy)
router.patch("/verify-code", verifyEmailWithCode); // verify email with code
// token-based verification link (legacy and manual link opens)
router.get("/verify", verifyEmailByTokenController);
router.get("/verify-token", verifyEmailByTokenController);

// password reset routes (link-based)
router.post("/forgot-password", forgotPasswordLink); // request password reset link
router.patch("/reset-password", resetPasswordWithToken); // reset password using token

// legacy resend route
router.get("/resend-code/:id", resendVerificationLinkLegacy); // legacy resend verification code route

export default router;
