import { fetchDashboardMetricsService } from "../services/dashboardService.js";
import { handleResponse } from "../utils/handleResponse.js";

export const getDashboardMetrics = async (req, res) => {
  try {
    const userId = Number.parseInt(req.user?.id ?? req.user?.userId ?? req.user?.userid, 10);
    const roleId = Number.parseInt(req.user?.roleID ?? req.user?.roleid, 10);
    const metrics = await fetchDashboardMetricsService({ userId, roleId });

    return handleResponse(res, 200, "dashboard metrics fetched successfully", metrics);
  } catch (error) {
    console.error("failed to fetch dashboard metrics", error);
    return handleResponse(res, 500, "failed to fetch dashboard metrics", {
      error: error.message,
    });
  }
};

export default {
  getDashboardMetrics,
};
