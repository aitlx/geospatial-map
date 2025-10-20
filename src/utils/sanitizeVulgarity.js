const VULGAR_PATTERNS = [
  /f+u+c+k+/gi,
  /motherf+u+c+k+e*r*/gi,
  /s+h+i+t+/gi,
  /b+i+t+c+h+/gi,
  /a+s+s+h*o+l+e+/gi,
  /p+i+s*o*t*a+/gi,
  /p+u*t+a+/gi,
  /g+a+g+o+/gi,
  /t+a+n+g*\W*i+n*\W*a+/gi,
  /l+e+c+h+e+/gi,
  /p+a+k*i+u+p+/gi,
  /d+a*m+n+/gi,
]

const maskMatch = (match) => (typeof match === "string" ? "*".repeat([...match].length) : match)

const sanitizeString = (value) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return value
  }

  let sanitized = value
  for (const pattern of VULGAR_PATTERNS) {
    sanitized = sanitized.replace(pattern, (found) => maskMatch(found))
  }

  return sanitized
}

export const cleanseVulgarValue = (value) => {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === "string") {
    return sanitizeString(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => cleanseVulgarValue(item))
  }

  if (value instanceof Date) {
    return value
  }

  if (typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, val]) => {
      acc[key] = cleanseVulgarValue(val)
      return acc
    }, Array.isArray(value) ? [] : {})
  }

  return value
}

export const sanitizeLogRecord = (record) => {
  if (!record || typeof record !== "object") {
    return record
  }

  return {
    ...record,
    actor: cleanseVulgarValue(record.actor),
    action: cleanseVulgarValue(record.action),
    target_table: cleanseVulgarValue(record.target_table),
    target_id: cleanseVulgarValue(record.target_id),
    details: cleanseVulgarValue(record.details),
  }
}
