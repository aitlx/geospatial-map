export const handleResponse = (res, status, message, data = null) => {
  const success = status >= 200 && status < 300;

  return res.status(status).json({
    success,
    status,
    message,
    
    ...(data !== null && { data })
  });
};
