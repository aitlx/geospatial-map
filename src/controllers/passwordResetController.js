import pool from '../config/db.js';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../utils/sendEmail.js';
import { handleResponse } from '../utils/handleResponse.js';
import { hashPassword } from '../utils/hashPassword.js';
import userService from '../services/userService.js';
import { logService } from '../services/logService.js';

export const forgotPasswordLink = async (req, res) => {
  const { email, portal } = req.body || {};
  if (!email) return handleResponse(res, 400, 'email is required');
  
  if (!portal) {
    console.warn('forgotPasswordLink called without portal; rejecting to avoid cross-portal reset');
    return handleResponse(res, 200, 'If an account exists for this email, a reset link has been sent.');
  }

  try {
    const user = await userService.fetchUserByEmailService(email);
    
    try {
      const dbgRole = user ? (user.roleid ?? user.roleID ?? user.role ?? user.role_id) : null;
      console.log(`[PWRESET] request email=${email} portal=${portal} userExists=${!!user} userRole=${dbgRole}`);
    } catch (dbgErr) {
      console.warn('[PWRESET] debug log failed', dbgErr?.message || dbgErr);
    }

    const genericMessage = 'If an account exists for this email, a reset link has been sent.';

    if (!user) {
      console.warn(`Password reset requested for unknown email: ${email}`);
      // return 404 so the frontend can inform the caller that the account was not found
      return handleResponse(res, 404, 'no account found with this email');
    }

    const rawRole = user.roleid ?? user.roleID ?? user.role ?? user.role_id;
    const roleid = Number.isFinite(Number(rawRole)) ? Number(rawRole) : null;
    
    if (portal === 'admin') {
      if (![1, 2].includes(roleid)) {
        console.warn(`Password reset requested on admin portal for non-admin email: ${email}, role=${rawRole}`);
        console.log(`[PWRESET] decision=reject-admin-mismatch email=${email} role=${rawRole}`);
        return handleResponse(res, 404, 'no account found with this email');
      }
    } else if (portal === 'technician') {
      if (roleid !== 3) {
        console.warn(`Password reset requested on technician portal for non-technician email: ${email}, role=${rawRole}`);
        console.log(`[PWRESET] decision=reject-tech-mismatch email=${email} role=${rawRole}`);
        return handleResponse(res, 404, 'no account found with this email');
      }
    } else {
      console.warn(`Unknown portal value provided to forgot-password: ${portal}`);
      console.log(`[PWRESET] decision=reject-unknown-portal email=${email} portal=${portal}`);
      return handleResponse(res, 200, genericMessage);
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      return handleResponse(res, 200, genericMessage);
    }

    const token = jwt.sign({ userid: user.userid, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: process.env.PASSWORD_RESET_LINK_EXPIRES || '1h',
    });

    const expiresAt = new Date(Date.now() + (60 * 60 * 1000));
    try {
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at, is_used) VALUES ($1, $2, $3, FALSE)`,
        [user.userid, token, expiresAt]
      );
    } catch (dbErr) {
      console.error('Failed to persist password reset token, continuing anyway:', dbErr?.message || dbErr);
      await logService.add({ userId: user.userid, roleId: user.roleid, action: 'FORGOT_PASSWORD_PERSIST_FAILED', targetTable: 'users', targetId: user.userid, details: { summary: 'Failed to persist password reset token', error: String(dbErr?.message || dbErr) } }).catch(() => null);
    }

    const origin = process.env.FRONTEND_URL || 'http://localhost:5173';
    const path = process.env.PASSWORD_RESET_PATH || '/reset-password';
    const url = new URL(path, origin);
    url.searchParams.set('token', token);
    url.searchParams.set('email', user.email);

    const resetUrl = url.toString();

    const html = `
      <p>Hello <b>${user.firstname || 'there'}</b>,</p>
      <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Reset password</a></p>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
    `;

    try {
      console.log(`[PWRESET] decision=send-email email=${email} userId=${user.userid}`);
      await sendEmail({ to: user.email, subject: 'Password reset', html });
    } catch (sendErr) {
      console.error('Failed to send password reset email:', sendErr?.message || sendErr);
      await logService.add({ userId: user.userid, roleId: user.roleid, action: 'FORGOT_PASSWORD_EMAIL_FAILED', targetTable: 'users', targetId: user.userid, details: { summary: 'Failed to deliver password reset email', error: String(sendErr?.message || sendErr) } }).catch(() => null);
      return handleResponse(res, 200, genericMessage);
    }

    await logService.add({ userId: user.userid, roleId: user.roleid, action: 'FORGOT_PASSWORD', targetTable: 'users', targetId: user.userid, details: { summary: 'Password reset link requested' } }).catch(() => null);

    if (process.env.DEBUG_RETURN_RESET_LINK === 'true') {
      return handleResponse(res, 200, genericMessage, { resetUrl });
    }

    return handleResponse(res, 200, genericMessage);
  } catch (err) {
    console.error('forgotPasswordLink error:', err?.message || err);
    return handleResponse(res, 200, 'If an account exists for this email, a reset link has been sent.');
  }
};

export const resetPasswordWithToken = async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) return handleResponse(res, 400, 'token and newPassword are required');

  try {
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      return handleResponse(res, 500, 'server misconfiguration');
    }
    
    let record = null;
    try {
      const tokenResult = await pool.query(`SELECT * FROM password_reset_tokens WHERE token = $1 LIMIT 1`, [token]);
      if (!tokenResult.rows.length) return handleResponse(res, 400, 'invalid or expired token');

      record = tokenResult.rows[0];
      if (record.is_used) return handleResponse(res, 400, 'token has already been used');
      if (new Date(record.expires_at) < new Date()) return handleResponse(res, 400, 'token has expired');
    } catch (dbErr) {
      console.warn('Could not query password_reset_tokens; falling back to JWT-only verification:', dbErr?.message || dbErr);
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return handleResponse(res, 400, 'invalid or expired token');
    }

    let user;
    if (record) {
      const userResult = await pool.query(`SELECT * FROM users WHERE userid = $1 LIMIT 1`, [record.user_id]);
      user = userResult.rows[0];
      if (!user) return handleResponse(res, 404, 'user not found');
    } else {
      if (payload?.userid) {
        const userResult = await pool.query(`SELECT * FROM users WHERE userid = $1 LIMIT 1`, [payload.userid]);
        user = userResult.rows[0];
      } else if (payload?.email) {
        const userResult = await pool.query(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [payload.email]);
        user = userResult.rows[0];
      }

      if (!user) return handleResponse(res, 404, 'user not found');
    }

    const hashed = await hashPassword(newPassword);
    await pool.query(`UPDATE users SET password = $1 WHERE userid = $2`, [hashed, user.userid]);

    if (record) {
      try {
        await pool.query(`UPDATE password_reset_tokens SET is_used = TRUE WHERE id = $1`, [record.id]);
      } catch (dbErr) {
        console.warn('Failed to mark password reset token as used:', dbErr?.message || dbErr);
      }
    }

    await logService.add({ userId: user.userid, roleId: user.roleid, action: 'RESET_PASSWORD', targetTable: 'users', targetId: user.userid, details: { summary: 'Password reset via link' } });

    return handleResponse(res, 200, 'password reset successful');
  } catch (err) {
    console.error('resetPasswordWithToken error:', err?.message || err);
    return handleResponse(res, 500, 'internal server error');
  }
};