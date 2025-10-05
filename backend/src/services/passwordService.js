import userService from "./userService.js";
import { comparePassword, hashPassword } from "../utils/hashPassword.js";

const coercePassword = (value, fieldName) => {
  if (typeof value !== "string") {
    const error = new Error(`${fieldName} is required`);
    error.status = 400;
    throw error;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    const error = new Error(`${fieldName} cannot be empty`);
    error.status = 400;
    throw error;
  }

  return trimmed;
};

export const changeUserPassword = async ({ userId, currentPassword, newPassword }) => {
  if (!userId) {
    const error = new Error("missing user context");
    error.status = 401;
    throw error;
  }

  const current = coercePassword(currentPassword, "current password");
  const next = coercePassword(newPassword, "new password");

  let user;
  try {
    user = await userService.fetchUserbyIdService(userId);
  } catch (dbError) {
    console.error("failed to fetch user for password change:", dbError);
    throw dbError;
  }

  if (!user) {
    const error = new Error("user not found");
    error.status = 404;
    throw error;
  }

  if (!user.password) {
    const error = new Error("stored credentials unavailable for this account");
    error.status = 500;
    throw error;
  }

  let isCurrentMatch = false;
  try {
    isCurrentMatch = await comparePassword(current, user.password);
  } catch (compareError) {
    console.error("failed to compare current password:", compareError);
    const error = new Error("unable to verify current password");
    error.status = 400;
    throw error;
  }

  if (!isCurrentMatch) {
    const error = new Error("current password is incorrect");
    error.status = 400;
    throw error;
  }

  let isSamePassword = false;
  try {
    isSamePassword = await comparePassword(next, user.password);
  } catch (compareError) {
    console.error("failed to compare new password with stored hash:", compareError);
    const error = new Error("unable to validate new password");
    error.status = 400;
    throw error;
  }

  if (isSamePassword) {
    const error = new Error("new password must be different from current password");
    error.status = 400;
    throw error;
  }

  const hashedPassword = await hashPassword(next);
  const updated = await userService.updatePasswordService(userId, hashedPassword);

  return {
    userId: updated?.userid || user.userid,
    email: updated?.email || user.email,
  };
};
