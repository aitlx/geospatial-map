// hashPassword
import bcrypt from 'bcryptjs';

export async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(plainPassword, salt);
  return hashedPassword;
}
