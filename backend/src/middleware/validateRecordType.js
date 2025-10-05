import { RECORD_CONFIG, normalizeRecordTypeKey } from "../utils/approvalUtils.js";
import { handleResponse } from "../utils/handleResponse.js";

export const validateRecordType = (req, res, next) => {
  const normalizedType = normalizeRecordTypeKey(req.params?.recordType);

  if (!normalizedType) {
    return handleResponse(
      res,
      400,
      `Invalid record type: ${req.params?.recordType}. Must be one of: ${Object.keys(RECORD_CONFIG).join(", ")}`
    );
  }

  req.params.recordType = normalizedType;
  req.recordType = normalizedType;

  next();
};
