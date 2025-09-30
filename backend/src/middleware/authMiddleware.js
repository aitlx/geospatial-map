import jwt from "jsonwebtoken";
import { handleResponse } from "../utils/handleResponse.js";
import { ROLES } from "../config/roles.js";

// authenticate user via jwt
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req.cookies?.token;

  if (!token) {
    return handleResponse(res, 401, "unauthorized: no token provided");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // check if email is verified before granting access
    if (!decoded.verified) {
      return handleResponse(res, 403, "forbidden: please verify your email first");
    }

    req.user = decoded; // { id, roleID, email, verified }
    next();
  } catch (err) {
    return handleResponse(res, 403, "invalid or expired token");
  }
};

// authorize by role(s)
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.roleID)) {
      return handleResponse(res, 403, "forbidden: insufficient permissions");
    }
    next();
  };
};

// technicians can only access their own account
export const canAccessSelfOrAdmin = (req, res, next) => {
  const { id, roleID } = req.user;
  const targetId = parseInt(req.params.id, 10);

  // if technician is trying to access someone else → deny
  if (roleID === ROLES.TECHNICIAN && id !== targetId) {
    return handleResponse(res, 403, "forbidden: cannot access other accounts");
  }

  next();
};
