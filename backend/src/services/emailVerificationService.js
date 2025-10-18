import jwt from 'jsonwebtoken';
import { sendEmail } from '../utils/sendEmail.js';
import pool from '../config/db.js';

export class EmailDeliveryError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.verificationUrl = options.verificationUrl ?? null;
    this.cause = options.cause;
  }
}

const resolveVerificationUrl = (email, token) => {
  const origin =
    process.env.VERIFICATION_LINK_ORIGIN ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173';
  const path = process.env.VERIFICATION_LINK_PATH || '/verify-email';

  let url;
  try {
    url = new URL(path, origin);
  } catch (error) {
    url = new URL('/verify-email', 'http://localhost:5173');
  }

  if (email) url.searchParams.set('email', email);
  url.searchParams.set('token', token);

  return url.toString();
};

// Send a verification link signed with JWT (no DB table)
export const sendVerificationCode = async (user, isResend = false) => {
  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not configured');

    const normalizedEmail = String(user.email || '').trim().toLowerCase();

    const token = jwt.sign(
      { userid: user.userid, email: normalizedEmail },
      process.env.JWT_SECRET,
      { expiresIn: process.env.VERIFICATION_LINK_EXPIRES || '1h' }
    );

    const verificationUrl = resolveVerificationUrl(normalizedEmail, token);
    const firstName = user.firstname || user.firstName || user.name || 'there';

    const text = `Hello ${firstName},\n\nPlease verify your email address by visiting the link below within the next hour:\n${verificationUrl}\n\nIf you did not request this, you can safely ignore this message.`;

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
      await sendEmail({ to: normalizedEmail, subject: 'Confirm your email address', text, html });
    } catch (transportError) {
      console.error('sendVerificationCode email delivery failed:', transportError?.message || transportError);
      throw new EmailDeliveryError('Email delivery failed', { verificationUrl, cause: transportError?.message });
    }

    return { verificationUrl };
  } catch (err) {
    console.error('sendVerificationCode failed:', err?.message || err);
    throw err;
  }
};

// Verify a token that was created by sendVerificationCode
export const verifyCodeService = async (email, token) => {
  if (!token) return null;
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not configured');

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const tokenEmail = payload?.email ? String(payload.email).trim().toLowerCase() : null;
    const tokenUserId = payload?.userid || payload?.userId || null;

    // If an email was provided in the request, ensure it matches the token
    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!tokenEmail || tokenEmail !== normalizedEmail) return null;
    }

    // Resolve user either by userid or by token email
    let userResult;
    if (tokenUserId) {
      userResult = await pool.query(`SELECT * FROM users WHERE userid = $1 LIMIT 1`, [tokenUserId]);
    } else if (tokenEmail) {
      userResult = await pool.query(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [tokenEmail]);
    } else {
      return null;
    }

    const user = userResult.rows[0];
    if (!user) return null;

    const updatedUser = await pool.query(`UPDATE users SET is_verified = TRUE WHERE userid = $1 RETURNING *`, [user.userid]);
    return updatedUser.rows[0];
  } catch (err) {
    // token verify failed or db error
    console.warn('verifyCodeService failed to verify token:', err?.message || err);
    return null;
  }
};
