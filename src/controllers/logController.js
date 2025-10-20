import { logService } from "../services/logService.js";
import { handleResponse } from "../utils/handleResponse.js";
import { normalizeUserId } from "../services/userService.js";

export const getLogs = async (req, res, next) => {
    try {
        const logs = await logService.findAll();
        return handleResponse(res, 200, "Fetched all logs successfully", logs);
    } catch (err) {
        return next(err);
    }
};

export const getMyLogs = async (req, res, next) => {
    try {
        const resolvedId = normalizeUserId(
            req.user?.id ?? req.user?.userId ?? req.user?.userid ?? req.user?.user_id ?? null
        );

        if (resolvedId === null) {
            return handleResponse(res, 400, "session user id is invalid");
        }

        const logs = await logService.findByUser(resolvedId);
        return handleResponse(res, 200, "Fetched user logs successfully", logs);
    } catch (err) {
        return next(err);
    }
};