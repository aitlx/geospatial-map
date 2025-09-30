import { RECORD_CONFIG } from "../utils/approvalUtils.js";
import { handleResponse } from "../utils/handleResponse.js";

export const validateRecordType = (req, res, next) => {
  const { recordType } = req.params;

  if (!RECORD_CONFIG[recordType]) {
    return handleResponse(
      res,
      400,
      `Invalid record type: ${recordType}. Must be one of: ${Object.keys(RECORD_CONFIG).join(", ")}`
    );
  }

  next();
};
