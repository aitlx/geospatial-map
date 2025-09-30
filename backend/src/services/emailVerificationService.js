import { sendEmail } from "../utils/sendEmail.js";
import pool from "../config/db.js";
import { generateCode } from "../utils/generateCode.js";

// send a new verification code
export const sendVerificationCode = async (user, isResend = false) => {
  try {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // expires in 1 hour

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
      [user.userid, code, expiresAt]
    );

    const html = `
      <p>Hello <b>${user.firstname}</b>,</p>
      <p>Your email verification code is: <b>${code}</b></p>
      <p>This code will expire in 1 hour.</p>
    `;

    await sendEmail({
      to: user.email,
      subject: "Email Verification Code",
      html,
    });

    console.log(`${isResend ? "Resent" : "Sent"} code to ${user.email}`);
  } catch (err) {
    console.error("sendVerificationCode failed:", err.message);
    throw new Error("Could not send verification code");
  }
};

// verify the code
export const verifyCodeService = async (email, code) => {
  const userResult = await pool.query(
    `SELECT userid FROM users WHERE email=$1`,
    [email]
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
