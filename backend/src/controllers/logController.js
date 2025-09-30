import { logService } from "../services/logService.js";
import { handleResponse } from "../utils/handleResponse.js";

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
        const logs = await logService.findByUser(req.user?.id);
        return handleResponse(res, 200, "Fetched user logs successfully", logs);
    } catch (err) {
        return next(err);
    }
};