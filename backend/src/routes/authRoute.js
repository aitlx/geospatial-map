// routes/authRoute.js
import express from "express";
import cors from "cors";
import { registerValidation, loginValidation } from "../validators/authValidator.js";
import { registerUser, loginUser, logoutUser, forgotPassword, verifyResetCode, resetPassword } from "../controllers/authController.js";
import { verifyEmailWithCode, sendVerificationCode } from "../controllers/verifyEmailController.js";

const router = express.Router();

router.post("/register", registerValidation, registerUser);
router.post("/login", loginValidation, loginUser);
router.post("/logout", logoutUser);
router.post("/send-code", sendVerificationCode);
router.patch("/verify-code", verifyEmailWithCode);

router.post("/forgot-password", forgotPassword);
router.patch("/verify-reset-code", verifyResetCode);
router.patch("/reset-password", resetPassword);


export default router;
