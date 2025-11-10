import userService from "../services/userService.js";
import pool from "../config/db.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/sendEmail.js";
import { validationResult } from "express-validator";
import { handleResponse } from "../utils/handleResponse.js";
import { sendVerificationCode } from "../services/emailVerificationService.js";
import crypto from "crypto";
import { hashPassword, comparePassword } from "../utils/hashPassword.js";
import { logService } from "../services/logService.js";
import { ROLES } from "../config/roles.js";
import { maskEmail } from "../utils/maskEmail.js";

const generateResetCode = (length = 6) => {
  const max = 10 ** length;
  const min = 10 ** (length - 1);
  return crypto.randomInt(min, max).toString();
};

// =========== auth & email verification ===========

// register endpoint
export const registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return handleResponse(res, 400, "Validation failed", errors.array());
  }

  const { firstName, lastName, birthday, gender, email, contactNumber, password, roleID } = req.body;

  try {
    if (![1, 2, 3].includes(roleID)) {
      return handleResponse(res, 400, "Invalid role id");
    }

    const existingUser = await userService.fetchUserByEmailService(email);
    if (existingUser) {
      return handleResponse(res, 409, "Email is already taken");
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await userService.createUserService(
      roleID,
      firstName,
      lastName,
      birthday,
      gender,
      email,
      contactNumber,
      hashedPassword
    );

    if (!newUser) {
      return handleResponse(res, 500, "Failed to create user");
    }

    await sendVerificationCode(newUser).catch(err =>
      console.error("Verification code send failed:", err.message)
    );

    // log registration
    await logService.add({
      userId: newUser.userid,
      roleId: newUser.roleid,
      action: "REGISTER_USER",
      targetTable: "users",
      targetId: newUser.userid,
      details: {
        summary: "New account registered",
        roleId: newUser.roleid,
        emailMasked: maskEmail(newUser.email),
      },
    });

    return handleResponse(res, 201, "User account created successfully! please verify your email.", {
      id: newUser.userid,
      firstName: newUser.firstname,
      lastName: newUser.lastname,
      email: newUser.email,
      roleID: newUser.roleid,
    });
  } catch (err) {
    return handleResponse(res, 500, "Internal server error");
  }
};

// login endpoint
export const loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return handleResponse(res, 400, "Validation failed", errors.array());
  }

  const { email, password } = req.body;

  try {
    const user = await userService.fetchUserByEmailService(email);

    if (!user || !(await comparePassword(password, user.password))) {
      return handleResponse(res, 401, "Invalid email or password");
    }

    // prevent admin/superadmin accounts from authenticating via the technician portal.
    const candidateRole = user.roleid || user.roleID;
    if ([ROLES.ADMIN, ROLES.SUPERADMIN].includes(candidateRole)) {
      console.warn(`technician portal login attempt using admin account email=${email} role=${candidateRole}`);
      return handleResponse(res, 404, "Account not found");
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment');
      return handleResponse(res, 500, 'Server misconfiguration');
    }

    const token = jwt.sign(
      {
        id: user.userid || user.id,
        roleID: user.roleid || user.roleID,
        email: user.email,
        verified: user.is_verified,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

  // Cookie options - allow cross-site cookies in production (HTTPS)
const isProduction = process.env.NODE_ENV === "production" || process.env.HOSTED === "true";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};


    res.cookie("token", token, cookieOptions);

    // log login
    await logService.add({
      userId: user.userid,
      roleId: user.roleid,
      action: "LOGIN_USER",
      targetTable: "users",
      targetId: user.userid,
      details: {
        summary: "User signed in",
        emailMasked: maskEmail(user.email),
        verified: Boolean(user.is_verified),
      },
    });

    return handleResponse(res, 200, "login successful!", {
      token,
      user: {
        id: user.userid || user.id,
        name: `${user.firstname} ${user.lastname}`,
        email: user.email,
        roleID: user.roleid || user.roleID,
      },
    });
  } catch (err) {
    console.error("login error:", err);
    return handleResponse(res, 500, "Internal server error");
  }
};

export const loginAdmin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return handleResponse(res, 400, "Validation failed", errors.array());
  }

  const { email, password } = req.body;

  try {
    const user = await userService.fetchUserByEmailService(email);

    if (!user || !(await comparePassword(password, user.password))) {
      return handleResponse(res, 401, "Invalid email or password");
    }

    const roleId = user.roleid || user.roleID;
    
    if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(roleId)) {
      return handleResponse(res, 404, "Account not found");
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment');
      return handleResponse(res, 500, 'Server misconfiguration');
    }

    const token = jwt.sign(
      {
        id: user.userid || user.id,
        roleID: roleId,
        email: user.email,
        verified: user.is_verified,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie("token", token, cookieOptions);

    await logService.add({
      userId: user.userid,
      roleId,
      action: "LOGIN_ADMIN",
      targetTable: "users",
      targetId: user.userid,
      details: {
        summary: "Administrator signed in",
        emailMasked: maskEmail(user.email),
      },
    });

    return handleResponse(res, 200, "Admin login successful", {
      token,
      user: {
        id: user.userid || user.id,
        name: `${user.firstname} ${user.lastname}`.trim(),
        email: user.email,
        roleID: roleId,
        role: roleId === ROLES.SUPERADMIN ? "superadmin" : "admin",
      },
    });
  } catch (err) {
    return handleResponse(res, 500, "Internal server error");
  }
};

// logout endpoint
export const logoutUser = async (req, res) => {
  try {
    // clear jwt cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/"
    });

    let actor = req.user;

    if (!actor?.id) {
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
      const cookieToken = req.cookies?.token;
      const token = bearerToken || cookieToken;

      if (token) {
        try {
          actor = jwt.verify(token, process.env.JWT_SECRET);
        } catch (verifyError) {
          const decoded = jwt.decode(token);
          if (decoded && typeof decoded === "object" && decoded !== null) {
            actor = decoded;
          }
        }
      }
    }

    if (actor?.id) {
      await logService.add({
        userId: actor.id,
        roleId: actor.roleID,
        action: "LOGOUT_USER",
        targetTable: "users",
        targetId: actor.id,
        details: { summary: "Session ended" },
      });
    }

    return handleResponse(res, 200, "Logout successful");
  } catch (err) {
    console.error("logout error:", err);
    return handleResponse(res, 500, "Internal server error");
  }
};


// =========== password reset ===========

// request password reset
export const forgotPassword = async (req, res) => {
  return handleResponse(res, 200, 'If an account exists for this email, a reset link has been sent.');
};

// verify reset code
export const verifyResetCode = async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await userService.fetchUserByEmailService(email);
    if (!user) {
      return handleResponse(res, 404, "User not found");
    }

    const result = await pool.query(
      `select * from password_reset_codes 
       where user_id = $1 and code = $2
       order by created_at desc limit 1`,
      [user.userid, code]
    );

    if (!result.rows.length) {
      return handleResponse(res, 400, "Invalid or expired code");
    }

    const record = result.rows[0];

    if (new Date(record.expires_at) < new Date()) {
      return handleResponse(res, 400, "Code expired");
    }

    // log verification
    await logService.add({
      userId: user.userid,
      roleId: user.roleid,
      action: "VERIFY_RESET_CODE",
      targetTable: "password_reset_codes",
      targetId: record.id,
      details: {
        summary: "Reset code confirmed",
      },
    });

    return handleResponse(res, 200, "Code verified successfully");
  } catch (err) {
    console.error("verify reset code error:", err);
    return handleResponse(res, 500, "Internal server error");
  }
};

// reset password
export const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    const userResult = await pool.query(
      `select userid from users where email=$1`,
      [email]
    );

    if (!userResult.rows.length) {
      return handleResponse(res, 404, "User not found");
    }

    const userId = userResult.rows[0].userid;

    const codeResult = await pool.query(
      `select * from password_reset_codes
       where user_id = $1 and code = $2 
       order by created_at desc limit 1`,
      [userId, code]
    );

    if (!codeResult.rows.length) {
      return handleResponse(res, 400, "Invalid or expired code");
    }

    const record = codeResult.rows[0];

    if (new Date(record.expires_at) < new Date()) {
      return handleResponse(res, 400, "Code has expired");
    }

    const hashedPassword = await hashPassword(newPassword);

    await pool.query(
      `update users set password = $1 where userid = $2`,
      [hashedPassword, userId]
    );

    await pool.query(
      `delete from password_reset_codes where id = $1`,
      [record.id]
    );

    // log password reset
    await logService.add({
      userId: userId,
      roleId: null,
      action: "RESET_PASSWORD",
      targetTable: "users",
      targetId: userId,
      details: { summary: "Password reset completed" },
    });

    return handleResponse(res, 200, "Password has been reset successfully");
  } catch (err) {
    return handleResponse(res, 500, "Internal server error");
  }
};
