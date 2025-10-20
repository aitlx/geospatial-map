import pool from "../config/db.js";
import { hashPassword } from "../utils/hashPassword.js";
import { ROLES } from "../config/roles.js";
import { isDatabaseUnavailableCause, wrapDatabaseUnavailable } from "../utils/databaseErrors.js";

const SORTABLE_COLUMNS = {
  createdAt: "createdat",
  name: "firstname",
  email: "email",
};

const sanitizeSort = (sortBy = "createdAt") => {
  return SORTABLE_COLUMNS[sortBy] || SORTABLE_COLUMNS.createdAt;
};

const sanitizeOrder = (order = "desc") => {
  return ["asc", "desc"].includes(order.toLowerCase()) ? order.toLowerCase() : "desc";
};

const ALLOWED_ROLE_IDS = new Set(Object.values(ROLES).map((value) => Number(value)));

const resolveRoleIds = (roleIds) => {
  if (Array.isArray(roleIds)) {
    const normalized = roleIds
      .map((role) => {
        if (typeof role === "number" && Number.isInteger(role)) {
          return role;
        }

        if (typeof role === "string") {
          const trimmed = role.trim();
          if (!trimmed.length) return null;

          const numeric = Number.parseInt(trimmed, 10);
          if (!Number.isNaN(numeric)) {
            return numeric;
          }
        }

        return null;
      })
      .filter((value) => value !== null && ALLOWED_ROLE_IDS.has(value));

    if (normalized.length) {
      return Array.from(new Set(normalized));
    }
  }

  return [ROLES.TECHNICIAN];
};

const normalizeBooleanFilter = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "verified", "active"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "unverified", "inactive"].includes(normalized)) {
    return false;
  }

  return null;
};

const coerceDate = (value) => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const fetchTechniciansService = async (options = {}) => {
  const {
    search,
    gender,
    verified,
    createdFrom,
    createdTo,
    sortBy,
    sortOrder,
    page = 1,
    pageSize = 10,
    roleIds,
  } = options;

  const limit = Math.min(Math.max(parseInt(pageSize, 10) || 10, 1), 100);
  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (currentPage - 1) * limit;

  const resolvedRoles = resolveRoleIds(roleIds);

  const conditions = ["roleid = ANY($1)"];
  const values = [resolvedRoles];
  let paramIndex = values.length + 1;

  if (search) {
    conditions.push(`(
      concat_ws(' ', firstname, lastname) ILIKE $${paramIndex}
      OR email ILIKE $${paramIndex}
      OR contactnumber ILIKE $${paramIndex}
    )`);
    values.push(`%${search.trim()}%`);
    paramIndex += 1;
  }

  if (gender) {
    conditions.push(`LOWER(gender) = $${paramIndex}`);
    values.push(gender.trim().toLowerCase());
    paramIndex += 1;
  }

  const verifiedFilter = normalizeBooleanFilter(verified);
  if (verifiedFilter !== null) {
    conditions.push(`is_verified = $${paramIndex}`);
    values.push(verifiedFilter);
    paramIndex += 1;
  }

  const fromDate = coerceDate(createdFrom);
  if (fromDate) {
    conditions.push(`createdat >= $${paramIndex}`);
    values.push(fromDate);
    paramIndex += 1;
  }

  const toDate = coerceDate(createdTo);
  if (toDate) {
    conditions.push(`createdat <= $${paramIndex}`);
    values.push(toDate);
    paramIndex += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const sortColumn = sanitizeSort(sortBy);
  const orderDirection = sanitizeOrder(sortOrder);

  const countQuery = `
    SELECT 
      COUNT(*)::int AS total,
      COALESCE(SUM(CASE WHEN is_verified = true THEN 1 ELSE 0 END), 0) AS verified_count,
      COALESCE(SUM(CASE WHEN is_verified = false THEN 1 ELSE 0 END), 0) AS unverified_count
    FROM users
    ${whereClause}
  `;

  const baseValues = [...values];
  const countResult = await pool.query(countQuery, baseValues);
  const { total = 0, verified_count = 0, unverified_count = 0 } = countResult.rows[0] || {};

  const dataValues = [...values, limit, offset];
  const limitParam = dataValues.length - 1;
  const offsetParam = dataValues.length;

  const dataQuery = `
    SELECT 
      userid,
      firstname,
      lastname,
      email,
      contactnumber,
      gender,
      birthday,
      profileimg,
      roleid,
      is_verified,
      createdat
    FROM users
    ${whereClause}
    ORDER BY ${sortColumn} ${orderDirection.toUpperCase()}, userid ASC
    LIMIT $${limitParam} OFFSET $${offsetParam}
  `;

  const dataResult = await pool.query(dataQuery, dataValues);

  const totalPages = Math.ceil(total / limit) || 1;

  const roleCountsQuery = `
    SELECT 
      roleid,
      COUNT(*)::int AS total,
      COALESCE(SUM(CASE WHEN is_verified = true THEN 1 ELSE 0 END), 0)::int AS verified_count,
      COALESCE(SUM(CASE WHEN is_verified = false THEN 1 ELSE 0 END), 0)::int AS unverified_count
    FROM users
    ${whereClause}
    GROUP BY roleid
  `;

  const roleCountsResult = await pool.query(roleCountsQuery, baseValues);
  const roleCounts = roleCountsResult.rows.reduce((acc, row) => {
    acc[row.roleid] = {
      total: Number(row.total) || 0,
      verified: Number(row.verified_count) || 0,
      unverified: Number(row.unverified_count) || 0,
    };
    return acc;
  }, {});

  return {
    results: dataResult.rows,
    pagination: {
      page: currentPage,
      pageSize: limit,
      total,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
    summary: {
      verified: Number(verified_count) || 0,
      unverified: Number(unverified_count) || 0,
      roleCounts,
    },
    appliedFilters: {
      search: search || "",
      gender: gender || "all",
      verified: verifiedFilter,
      roleIds: resolvedRoles,
      sortBy: sortBy || "createdAt",
      sortOrder: orderDirection,
      createdFrom: createdFrom || null,
      createdTo: createdTo || null,
    },
  };
};

// Fetch a single user by ID
export const normalizeUserId = (value) => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return null;
};

const fetchUserbyIdService = async (userid) => {
  const normalizedId = normalizeUserId(userid);
  if (normalizedId === null) {
    return null;
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE userid = $1", [normalizedId]);
    return result.rows[0] ?? null;
  } catch (error) {
    if (isDatabaseUnavailableCause(error)) {
      throw wrapDatabaseUnavailable(error);
    }

    throw error;
  }
};

// fetch user by email (case-insensitive, trims input)
const fetchUserByEmailService = async (email) => {
  if (!email) return null;
  const normalized = String(email).trim().toLowerCase();
  const result = await pool.query("SELECT * FROM users WHERE LOWER(email) = $1", [normalized]);
  return result.rows[0] ?? null; // returns user object or null
};

// create user
export const createUserService = async (
  roleID,
  firstName,
  lastName,
  birthday,
  gender,
  email,
  contactNumber,
  hashedPassword
) => {

  const result = await pool.query(
    `INSERT INTO users (roleid, firstname, lastname, birthday, gender, email, contactnumber, password, createdat)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     RETURNING userid, roleid, firstname, lastname, email`,
    [roleID, firstName, lastName, birthday, gender, email, contactNumber, hashedPassword]
  );
  return result.rows[0];
};


// update user
export const updateUserService = async (
  userID,
  firstname,
  lastname,
  birthday,
  gender,
  email,
  contactNumber,
  bio,
  plainPassword,
  profileimg,
  roleId
) => {
  // hash password only if provided
  let hashedPassword = null;
  if (plainPassword) {
    hashedPassword = await hashPassword(plainPassword);
  }

  const params = [
    firstname,
    lastname,
    birthday,
    gender,
    email,
    contactNumber,
    bio,
    hashedPassword,
    profileimg,
    roleId,
    userID,
  ];

  try {
    const result = await pool.query(
      `UPDATE users SET 
        firstname = $1,
        lastname = $2,
        birthday = $3,
        gender = $4,
        email = $5,
        contactnumber = $6,
        bio = COALESCE($7, bio),
        password = COALESCE($8, password),
        profileimg = COALESCE($9, profileimg),
        roleid = COALESCE($10, roleid),
        updatedat = NOW()
      WHERE userid = $11
      RETURNING userid, roleid, firstname, lastname, email, contactnumber, gender, bio, profileimg, is_verified, createdat, updatedat`,
      params
    );

    return result.rows[0];
  } catch (error) {
    const missingUpdatedAt =
      error?.message?.toLowerCase().includes("column") &&
      error.message.toLowerCase().includes("updatedat");

    if (!missingUpdatedAt) {
      throw error;
    }

    console.warn(
      "users.updatedat column missing; updating user without timestamp column"
    );

    const fallback = await pool.query(
      `UPDATE users SET 
        firstname = $1,
        lastname = $2,
        birthday = $3,
        gender = $4,
        email = $5,
        contactnumber = $6,
        bio = COALESCE($7, bio),
        password = COALESCE($8, password),
        profileimg = COALESCE($9, profileimg),
        roleid = COALESCE($10, roleid)
      WHERE userid = $11
      RETURNING userid, roleid, firstname, lastname, email, contactnumber, gender, bio, profileimg, is_verified, createdat`,
      params
    );

    const fallbackRow = fallback.rows[0]
      ? { ...fallback.rows[0], updatedat: null }
      : null;

    return fallbackRow;
  }
};


// delete user
const deleteUserService = async (userID) => {
  const result = await pool.query(
    `DELETE FROM users WHERE userID = $1 RETURNING *`,
    [userID]
  );
  return result.rows[0];
};

const updatePasswordService = async (userID, hashedPassword) => {
  const params = [hashedPassword, userID];

  try {
    const result = await pool.query(
      `UPDATE users
         SET password = $1,
             updatedat = NOW()
       WHERE userid = $2
       RETURNING userid, roleid, email`,
      params
    );

    return result.rows[0];
  } catch (error) {
    const missingUpdatedAt =
      error?.message?.toLowerCase().includes("column") &&
      error.message.toLowerCase().includes("updatedat");

    if (!missingUpdatedAt) {
      throw error;
    }

    console.warn(
      "users.updatedat column missing; updating password without timestamp column"
    );

    const fallback = await pool.query(
      `UPDATE users
         SET password = $1
       WHERE userid = $2
       RETURNING userid, roleid, email`,
      params
    );

    return fallback.rows[0];
  }
};

// export as userService object
const userService = {
  fetchTechniciansService,
  fetchUserbyIdService,
  fetchUserByEmailService,
  createUserService,
  updateUserService,
  deleteUserService,
  updatePasswordService,
};

export default userService;
