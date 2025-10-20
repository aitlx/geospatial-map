export class DatabaseUnavailableError extends Error {
  constructor(message = "database unavailable", options = {}) {
    super(message, options)
    this.name = "DatabaseUnavailableError"
    this.code = "DATABASE_UNAVAILABLE"
  }
}

const DB_UNAVAILABLE_CODES = new Set(["ECONNREFUSED", "57P03", "53300", "ETIMEDOUT"])

const extractNestedErrors = (error) => {
  if (!error) return []
  const aggregate = []

  if (Array.isArray(error.errors)) {
    aggregate.push(...error.errors)
  }

  if (error.cause) {
    aggregate.push(error.cause)
  }

  return aggregate
}

export const isDatabaseUnavailableCause = (error) => {
  if (!error) return false

  if (DB_UNAVAILABLE_CODES.has(error.code)) {
    return true
  }

  if (error.code === "ECONNRESET" || error.code === "PROTOCOL_CONNECTION_LOST") {
    return true
  }

  if (error.name === "AggregateError") {
    return extractNestedErrors(error).some(isDatabaseUnavailableCause)
  }

  return extractNestedErrors(error).some(isDatabaseUnavailableCause)
}

export const wrapDatabaseUnavailable = (error) => {
  if (!error) {
    return new DatabaseUnavailableError()
  }

  const message = error.message || "database unavailable"
  const wrapped = new DatabaseUnavailableError(message, { cause: error })
  wrapped.meta = { originalCode: error.code }
  return wrapped
}
