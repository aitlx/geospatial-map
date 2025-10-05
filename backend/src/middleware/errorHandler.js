import { handleResponse } from "../utils/handleResponse.js"

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const status = Number.isInteger(err?.statusCode) ? err.statusCode : Number.isInteger(err?.status) ? err.status : 500
  const shouldExpose = status < 500 || err?.expose === true

  const message = shouldExpose && err?.message
    ? err.message
    : "An unexpected error occurred while processing the request."

  const details = err?.details && typeof err.details === "object" ? err.details : null

  if (process.env.NODE_ENV !== "test") {
    const logContext = {
      status,
      message: err?.message,
      details,
    }
    console.error("Request failed", logContext, err)
  }

  const payload = {
    ...(details ? { details } : {}),
  }

  return handleResponse(res, status, message, Object.keys(payload).length ? payload : null)
}
