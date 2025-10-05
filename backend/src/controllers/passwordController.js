import { changeUserPassword } from "../services/passwordService.js";
import { handleResponse } from "../utils/handleResponse.js";
import { logService } from "../services/logService.js";
import { maskEmail } from "../utils/maskEmail.js";

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body ?? {};

  if (!req.user?.id) {
    return handleResponse(res, 401, "unauthorized: no token provided");
  }

  if (!currentPassword || !newPassword || !confirmPassword) {
    return handleResponse(res, 400, "current, new, and confirm password are required");
  }

  if (newPassword !== confirmPassword) {
    return handleResponse(res, 400, "new password and confirmation do not match");
  }

  try {
    const { userId, email } = await changeUserPassword({
      userId: req.user.id,
      currentPassword,
      newPassword,
    });

    try {
      await logService.add({
        userId: req.user.id,
        roleId: req.user?.roleID || null,
        action: "CHANGE_PASSWORD",
        targetTable: "users",
        targetId: userId,
        details: {
          summary: "Account password updated",
          emailMasked: maskEmail(email),
        },
      });
    } catch (logError) {
      console.error("failed to log password change:", logError);
    }

    return handleResponse(res, 200, "password updated successfully");
  } catch (error) {
    console.error("change password error:", error);

    if (error.status) {
      return handleResponse(res, error.status, error.message);
    }

    return handleResponse(res, 500, "internal server error");
  }
};
