// routes/authRoute.js
import express from "express";
import cors from "cors";
import { loginValidation } from "../validators/authValidator.js";
import { loginUser, loginAdmin, logoutUser, forgotPassword, verifyResetCode, resetPassword } from "../controllers/authController.js";
import { verifyEmailWithCode, sendVerificationCode } from "../controllers/verifyEmailController.js";

const router = express.Router();

router.post("/login", loginValidation, loginUser);
router.post("/admin/login", loginValidation, loginAdmin);
router.post("/logout", logoutUser);
router.post("/send-code", sendVerificationCode);
router.get("/send-code", sendVerificationCode);
router.post("/send-link", sendVerificationCode);
router.get("/send-link", sendVerificationCode);
router.patch("/verify-code", verifyEmailWithCode);

router.post("/forgot-password", forgotPassword);
router.patch("/verify-reset-code", verifyResetCode);
router.patch("/reset-password", resetPassword);


export default router;
