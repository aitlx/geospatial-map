import pool from "../config/db.js";
import { handleResponse } from "../utils/handleResponse.js";
import { sendVerificationCode as sendVerificationCodeService } from "../services/emailVerificationService.js";
import { verifyCodeService } from "../services/emailVerificationService.js";

// SEND verification code
export const sendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return handleResponse(res, 400, "Email is required");
    }

    // find user
    const userResult = await pool.query(`SELECT * FROM users WHERE email=$1`, [email]);
    if (!userResult.rows[0]) {
      return handleResponse(res, 404, "User not found");
    }
    const user = userResult.rows[0];

    // send code (via service)
    await sendVerificationCodeService(user);

    return handleResponse(res, 200, "Verification code sent successfully");
  } catch (err) {
    console.error("Send verification code failed:", err.message);
    return handleResponse(res, 500, "Internal server error");
  }
};

// VERIFY code
export const verifyEmailWithCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return handleResponse(res, 400, "Email and code are required");
    }

    const verifiedUser = await verifyCodeService(email, code);

    if (!verifiedUser) {
      return handleResponse(res, 400, "Invalid or expired verification code");
    }

    return handleResponse(res, 200, "Email verified successfully", {
      id: verifiedUser.userid,
      email: verifiedUser.email,
      is_verified: verifiedUser.is_verified,
    });
  } catch (err) {
    console.error("Email verification failed:", err);
    return handleResponse(res, 500, "Internal server error");
  }
};

export const resendVerificationCodeController = async (req, res) => {
  try {
    const { email } = req.body; 
    if (!email) return handleResponse(res, 400, "Email is required");

    const userResult = await pool.query(`SELECT * FROM users WHERE email=$1`, [email]);
    if (!userResult.rows[0]) return handleResponse(res, 404, "User not found");

    const user = userResult.rows[0];

    // send new code and mark old ones unused
    await sendVerificationCodeService(user, true);

    return handleResponse(res, 200, "Verification code resent successfully");
  } catch (err) {
    console.error("Resend verification code failed:", err);
    return handleResponse(res, 500, "Internal server error");
  }
};