export const handleResponse = (res, status, message, data = null) => {
  const success = status >= 200 && status < 300;

  // Build payload explicitly to avoid spreading a non-object when data is null.
  const payload = {
    success,
    status,
    message,
  };

  if (data !== null) {
    payload.data = data;
  }

  return res.status(status).json(payload);
};
