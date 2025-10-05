import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import pool from "../config/db.js";

export class EmailDeliveryError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "EmailDeliveryError";
    this.verificationUrl = options.verificationUrl ?? null;
    this.cause = options.cause;
  }
}

let ensureTablePromise = null;

const ensureVerificationTable = async () => {
  if (ensureTablePromise) {
    return ensureTablePromise;
  }

  ensureTablePromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS email_verification_codes (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
          code VARCHAR(128) NOT NULL,
          expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
          is_used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS email_verification_codes_user_id_idx
          ON email_verification_codes (user_id)
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS email_verification_codes_code_idx
          ON email_verification_codes (code)
      `);
    } catch (error) {
      console.error("Failed to ensure email_verification_codes table", error);
      throw error;
    }
  })();

  try {
    await ensureTablePromise;
  } catch (error) {
    ensureTablePromise = null;
    throw error;
  }
};

const resolveVerificationUrl = (email, token) => {
  const origin =
    process.env.VERIFICATION_LINK_ORIGIN ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173";
  const path = process.env.VERIFICATION_LINK_PATH || "/verify-email";

  let url;
  try {
    url = new URL(path, origin);
  } catch (error) {
    url = new URL("/verify-email", "http://localhost:5173");
  }

  url.searchParams.set("email", email);
  url.searchParams.set("code", token);

  return url.toString();
};

// send a new verification code
export const sendVerificationCode = async (user, isResend = false) => {
  try {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // expires in 1 hour
    const normalizedEmail = String(user.email || "").trim().toLowerCase();

    await ensureVerificationTable();

    // if resend, clear old codes
    if (isResend) {
      await pool.query(
        `DELETE FROM email_verification_codes WHERE user_id = $1 AND is_used = FALSE`,
        [user.userid]
      );
    }

    await pool.query(
      `INSERT INTO email_verification_codes (user_id, code, expires_at)
       VALUES ($1, $2, $3)`,
      [user.userid, token, expiresAt]
    );

    const verificationUrl = resolveVerificationUrl(normalizedEmail, token);
    const firstName = user.firstname || user.firstName || user.name || "there";

    const text = `Hello ${firstName},\n\n` +
      `Please verify your email address by visiting the link below within the next hour:\n${verificationUrl}\n\n` +
      `If you did not request this, you can safely ignore this message.`;

    const html = `
      <p>Hello <b>${firstName}</b>,</p>
      <p>Tap the button below to verify your email address. This link will expire in 1 hour.</p>
      <p>
        <a href="${verificationUrl}" style="display:inline-block;padding:12px 20px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
          Verify my email
        </a>
      </p>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    `;

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Confirm your email address",
        text,
        html,
      });

      console.log(`${isResend ? "Resent" : "Sent"} verification link to ${user.email}`);
    } catch (transportError) {
      console.error("sendVerificationCode email delivery failed:", transportError);
      throw new EmailDeliveryError("Email delivery failed", {
        verificationUrl,
        cause: transportError,
      });
    }

    return { verificationUrl };
  } catch (err) {
    if (err instanceof EmailDeliveryError) {
      throw err;
    }

    console.error("sendVerificationCode failed:", err);
    throw new Error("Could not send verification email");
  }
};

// verify the code
export const verifyCodeService = async (email, code) => {
  const normalizedEmail = email ? String(email).trim().toLowerCase() : "";
  if (!normalizedEmail) {
    return null;
  }

  await ensureVerificationTable();

  const userResult = await pool.query(
    `SELECT userid FROM users WHERE email=$1`,
    [normalizedEmail]
  );
  if (!userResult.rows[0]) return null;

  const userId = userResult.rows[0].userid;

  const codeResult = await pool.query(
    `SELECT * FROM email_verification_codes
     WHERE user_id = $1 AND code = $2 
       AND is_used = FALSE AND expires_at > NOW()`,
    [userId, code]
  );

  const record = codeResult.rows[0];
  if (!record) return null;

  await pool.query(
    `UPDATE email_verification_codes SET is_used = TRUE WHERE id = $1`,
    [record.id]
  );

  const updatedUser = await pool.query(
    `UPDATE users SET is_verified = TRUE WHERE userid = $1 RETURNING *`,
    [userId]
  );

  return updatedUser.rows[0];
};
