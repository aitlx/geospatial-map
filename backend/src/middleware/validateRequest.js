import { validationResult } from "express-validator";
import { handleResponse } from "../utils/handleResponse.js";

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return handleResponse(res, 400, "Validation failed", errors.array());
  }
  next();
};
