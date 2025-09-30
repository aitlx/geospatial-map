// hashPassword
import bcrypt from "bcryptjs";

export async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(12); 
  return bcrypt.hash(plainPassword, salt);
}

export async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}
