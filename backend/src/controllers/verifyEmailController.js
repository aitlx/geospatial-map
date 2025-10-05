import pool from "../config/db.js";
import { handleResponse } from "../utils/handleResponse.js";
import jwt from "jsonwebtoken";
import {
  EmailDeliveryError,
  sendVerificationCode as sendVerificationCodeService,
  verifyCodeService,
} from "../services/emailVerificationService.js";

const buildLegacyResponse = (message) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Email Verification</title>
    <style>
      body { font-family: "Inter", Arial, sans-serif; background-color: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
      main { max-width: 520px; margin: 10vh auto; background: rgba(15, 118, 110, 0.08); border-radius: 18px; border: 1px solid rgba(45, 212, 191, 0.35); padding: 32px; box-shadow: 0 35px 120px -45px rgba(16, 185, 129, 0.6); }
      h1 { font-size: 1.5rem; margin-bottom: 12px; color: #5eead4; }
      p { line-height: 1.5; font-size: 0.95rem; margin: 0; }
      .accent { color: #99f6e4; font-weight: 600; }
    </style>
  </head>
  <body>
    <main>
      <h1>Email verification update</h1>
      <p>${message}</p>
      <p style="margin-top: 20px; font-size: 0.85rem; color: rgba(226, 232, 240, 0.75);">
        If you did not request this, you can safely disregard this page.
      </p>
    </main>
  </body>
</html>`;

const extractToken = (req) => {
  if (req.cookies?.token) {
    return req.cookies.token;
  }

  const authHeader = req.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
};

const resolveEmail = (req) => {
  const candidates = [
    req.body?.email,
    req.body?.Email,
    req.query?.email,
    req.query?.Email,
    req.params?.email,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
};

const resolveAuthenticatedUser = async (req) => {
  const token = extractToken(req);
  if (!token || !process.env.JWT_SECRET) {
    return null;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = payload?.id || payload?.userId || payload?.userid;

    if (userId) {
      const userResult = await pool.query(`SELECT * FROM users WHERE userid = $1 LIMIT 1`, [userId]);
      const user = userResult.rows[0];
      if (!user) return null;
      const normalizedEmail = user.email ? String(user.email).trim().toLowerCase() : "";
      return { user, email: normalizedEmail };
    }

    const tokenEmail = payload?.email ? String(payload.email).trim().toLowerCase() : "";
    if (!tokenEmail) {
      return null;
    }

    const userResult = await pool.query(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [tokenEmail]);
    const user = userResult.rows[0];
    return user ? { user, email: tokenEmail } : null;
  } catch (error) {
    console.debug("Unable to resolve authenticated user", error?.message);
    return null;
  }
};

// SEND verification code
export const sendVerificationCode = async (req, res) => {
  try {
    const rawEmail = resolveEmail(req);
    let normalizedEmail = rawEmail ? rawEmail.toLowerCase() : "";
    let userRecord = null;

    if (normalizedEmail) {
      const userResult = await pool.query(`SELECT * FROM users WHERE email=$1 LIMIT 1`, [normalizedEmail]);
      userRecord = userResult.rows[0] ?? null;
    }

    if (!userRecord) {
      const authContext = await resolveAuthenticatedUser(req);
      if (authContext?.user) {
        userRecord = authContext.user;
        normalizedEmail = authContext.email || normalizedEmail;
      }
    }

    if (!normalizedEmail || !userRecord) {
      return handleResponse(res, 400, "Email is required");
    }

    if (userRecord?.is_verified) {
      return handleResponse(res, 200, "Email is already verified", {
        alreadyVerified: true,
        verificationUrl: null,
      });
    }

    const user = {
      ...userRecord,
      email: normalizedEmail,
    };

    // send code (via service)
    const result = await sendVerificationCodeService(user);

    return handleResponse(res, 200, "Verification link sent successfully", {
      verificationUrl: result?.verificationUrl ?? null,
    });
  } catch (err) {
    if (err instanceof EmailDeliveryError) {
      console.warn("Email delivery failed; returning manual verification link", err);
      return handleResponse(res, 202, "Verification link generated but email delivery failed", {
        verificationUrl: err.verificationUrl ?? null,
      });
    }

    console.error("Send verification link failed:", err.message);
    return handleResponse(res, 500, "Internal server error");
  }
};

// VERIFY code
export const verifyEmailWithCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    const normalizedEmail = email ? String(email).trim().toLowerCase() : "";

    if (!normalizedEmail || !code) {
      return handleResponse(res, 400, "Email and token are required");
    }

    const verifiedUser = await verifyCodeService(normalizedEmail, code);

    if (!verifiedUser) {
      return handleResponse(res, 400, "Invalid or expired verification link");
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
    const rawEmail = resolveEmail(req);
    let normalizedEmail = rawEmail ? rawEmail.toLowerCase() : "";
    let userRecord = null;

    if (normalizedEmail) {
      const userResult = await pool.query(`SELECT * FROM users WHERE email=$1 LIMIT 1`, [normalizedEmail]);
      userRecord = userResult.rows[0] ?? null;
    }

    if (!userRecord) {
      const authContext = await resolveAuthenticatedUser(req);
      if (authContext?.user) {
        userRecord = authContext.user;
        normalizedEmail = authContext.email || normalizedEmail;
      }
    }

    if (!normalizedEmail || !userRecord) {
      return handleResponse(res, 400, "Email is required");
    }

    if (userRecord?.is_verified) {
      return handleResponse(res, 200, "Email is already verified", {
        alreadyVerified: true,
        verificationUrl: null,
      });
    }

    const user = {
      ...userRecord,
      email: normalizedEmail,
    };

    // send new code and mark old ones unused
    const result = await sendVerificationCodeService(user, true);

    return handleResponse(res, 200, "Verification link resent successfully", {
      verificationUrl: result?.verificationUrl ?? null,
    });
  } catch (err) {
    if (err instanceof EmailDeliveryError) {
      console.warn("Resend verification link email delivery failed", err);
      return handleResponse(res, 202, "Verification link generated but email delivery failed", {
        verificationUrl: err.verificationUrl ?? null,
      });
    }

    console.error("Resend verification link failed:", err);
    return handleResponse(res, 500, "Internal server error");
  }
};

export const resendVerificationLinkLegacy = async (req, res) => {
  const genericMessage =
    "If this account exists, we've sent a fresh verification link. Please check your inbox and use the most recent email.";

  const unsafeId = req.params?.id;
  const parsedId = Number.parseInt(unsafeId, 10);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(200).send(buildLegacyResponse(genericMessage));
  }

  try {
    const result = await pool.query(
      `SELECT userid, email, firstname FROM users WHERE userid = $1 LIMIT 1`,
      [parsedId]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(200).send(buildLegacyResponse(genericMessage));
    }

    await sendVerificationCodeService(user, true);
    return res.status(200).send(buildLegacyResponse(genericMessage));
  } catch (error) {
    console.warn("Legacy verification resend failed", error);
    return res.status(200).send(buildLegacyResponse(genericMessage));
  }
};