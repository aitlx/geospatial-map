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
    return handleResponse(res, 400, "validation failed", errors.array());
  }

  const { firstName, lastName, birthday, gender, email, contactNumber, password, roleID } = req.body;

  try {
    if (![1, 2, 3].includes(roleID)) {
      return handleResponse(res, 400, "invalid role id");
    }

    const existingUser = await userService.fetchUserByEmailService(email);
    if (existingUser) {
      return handleResponse(res, 409, "email is already taken");
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
      return handleResponse(res, 500, "failed to create user");
    }

    await sendVerificationCode(newUser).catch(err =>
      console.error("verification code send failed:", err.message)
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

    return handleResponse(res, 201, "user account created successfully! please verify your email.", {
      id: newUser.userid,
      firstName: newUser.firstname,
      lastName: newUser.lastname,
      email: newUser.email,
      roleID: newUser.roleid,
    });
  } catch (err) {
    console.error("error during registration:", err);
    return handleResponse(res, 500, "internal server error");
  }
};

// login endpoint
export const loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return handleResponse(res, 400, "validation failed", errors.array());
  }

  const { email, password } = req.body;

  try {
    const user = await userService.fetchUserByEmailService(email);

    if (!user || !(await comparePassword(password, user.password))) {
      return handleResponse(res, 401, "invalid email or password");
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment');
      return handleResponse(res, 500, 'server misconfiguration');
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

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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
    return handleResponse(res, 500, "internal server error");
  }
};

export const loginAdmin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return handleResponse(res, 400, "validation failed", errors.array());
  }

  const { email, password } = req.body;

  try {
    const user = await userService.fetchUserByEmailService(email);

    if (!user || !(await comparePassword(password, user.password))) {
      return handleResponse(res, 401, "invalid email or password");
    }

    const roleId = user.roleid || user.roleID;
    if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(roleId)) {
      return handleResponse(res, 403, "account does not have administrative access");
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment');
      return handleResponse(res, 500, 'server misconfiguration');
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

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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

    return handleResponse(res, 200, "admin login successful", {
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
    console.error("admin login error:", err);
    return handleResponse(res, 500, "internal server error");
  }
};

// logout endpoint
export const logoutUser = async (req, res) => {
  try {
    // clear jwt cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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

    return handleResponse(res, 200, "logout successful");
  } catch (err) {
    console.error("logout error:", err);
    return handleResponse(res, 500, "internal server error");
  }
};


// =========== password reset ===========

// request password reset
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await userService.fetchUserByEmailService(email);
    if (!user) {
      return handleResponse(res, 404, "no account found with this email");
    }

  const code = generateResetCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `insert into password_reset_codes (user_id, code, expires_at)
       values ($1, $2, $3)`,
      [user.userid, code, expiresAt]
    );

    const html = `
      <p>hello <b>${user.firstname}</b>,</p>
      <p>you requested a password reset.</p>
      <p>your verification code is: <b>${code}</b></p>
      <p>this code will expire in 10 minutes.</p>
    `;

    await sendEmail({
      to: user.email,
      subject: "password reset code",
      html,
    });

    // log forgot password
    await logService.add({
      userId: user.userid,
      roleId: user.roleid,
      action: "FORGOT_PASSWORD",
      targetTable: "users",
      targetId: user.userid,
      details: {
        summary: "Password reset requested",
        emailMasked: maskEmail(user.email),
      },
    });

    return handleResponse(res, 200, "password reset code sent to your email");
  } catch (err) {
    console.error("forgot password error:", err.message);
    return handleResponse(res, 500, "internal server error");
  }
};

// verify reset code
export const verifyResetCode = async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await userService.fetchUserByEmailService(email);
    if (!user) {
      return handleResponse(res, 404, "user not found");
    }

    const result = await pool.query(
      `select * from password_reset_codes 
       where user_id = $1 and code = $2
       order by created_at desc limit 1`,
      [user.userid, code]
    );

    if (!result.rows.length) {
      return handleResponse(res, 400, "invalid or expired code");
    }

    const record = result.rows[0];

    if (new Date(record.expires_at) < new Date()) {
      return handleResponse(res, 400, "code expired");
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

    return handleResponse(res, 200, "code verified successfully");
  } catch (err) {
    console.error("verify reset code error:", err);
    return handleResponse(res, 500, "internal server error");
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
      return handleResponse(res, 404, "user not found");
    }

    const userId = userResult.rows[0].userid;

    const codeResult = await pool.query(
      `select * from password_reset_codes
       where user_id = $1 and code = $2 
       order by created_at desc limit 1`,
      [userId, code]
    );

    if (!codeResult.rows.length) {
      return handleResponse(res, 400, "invalid or expired code");
    }

    const record = codeResult.rows[0];

    if (new Date(record.expires_at) < new Date()) {
      return handleResponse(res, 400, "code has expired");
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

    return handleResponse(res, 200, "password has been reset successfully");
  } catch (err) {
    console.error("reset password error:", err);
    return handleResponse(res, 500, "internal server error");
  }
};