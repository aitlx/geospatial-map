export const handleResponse = (res, status, message, data = null) => {
  return res.status(status).json({
    status,
    message,
    data,
  });
};