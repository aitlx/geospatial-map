import { fetchTechnicianNotifications } from "../services/notificationService.js";
import { handleResponse } from "../utils/handleResponse.js";
import { ROLES } from "../config/roles.js";

export const getTechnicianNotifications = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const roleId = req.user?.roleID;

    if (!userId) {
      return handleResponse(res, 401, "unauthorized");
    }

    if (roleId !== ROLES.TECHNICIAN) {
      return handleResponse(res, 403, "forbidden: technicians only");
    }

    const notifications = await fetchTechnicianNotifications(userId);
    return handleResponse(res, 200, "notifications fetched", notifications);
  } catch (error) {
    next(error);
  }
};

export default {
  getTechnicianNotifications,
};
