import crypto from "crypto";
import userService, { normalizeUserId } from "../services/userService.js";
import { handleResponse } from "../utils/handleResponse.js";
import { logService } from "../services/logService.js";
import { hashPassword } from "../utils/hashPassword.js";
import { ROLES } from "../config/roles.js";
import { EmailDeliveryError, sendVerificationCode } from "../services/emailVerificationService.js";
import { maskEmail } from "../utils/maskEmail.js";
import { DatabaseUnavailableError } from "../utils/databaseErrors.js";

const { 
  createUserService, 
  fetchTechniciansService, 
  deleteUserService, 
  fetchUserbyIdService, 
  updateUserService,
  updatePasswordService,
} = userService;

const CREATABLE_ROLES = new Set([ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.TECHNICIAN]);

const ROLE_LABELS = new Map([
  [ROLES.SUPERADMIN, "Super Admin"],
  [ROLES.ADMIN, "Admin"],
  [ROLES.TECHNICIAN, "Technician"],
  [ROLES.FARMER, "Farmer"],
]);

const ROLE_ALIAS_MAP = new Map([
  ["superadmin", ROLES.SUPERADMIN],
  ["super-admin", ROLES.SUPERADMIN],
  ["super_admin", ROLES.SUPERADMIN],
  ["admin", ROLES.ADMIN],
  ["administrator", ROLES.ADMIN],
  ["technician", ROLES.TECHNICIAN],
  ["farmer", ROLES.FARMER],
]);

const USER_MANAGEMENT_ROLE_IDS = [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.TECHNICIAN];

const parseRoleFilter = (value, fallback = USER_MANAGEMENT_ROLE_IDS) => {
  if (Array.isArray(value)) {
    const resolved = value
      .map((item) => normalizeRoleId(item))
      .filter((roleId) => roleId !== null && USER_MANAGEMENT_ROLE_IDS.includes(roleId));

    if (resolved.length) {
      return Array.from(new Set(resolved));
    }

    return fallback;
  }

  if (value === undefined || value === null) {
    return fallback;
  }

  const input = String(value).trim();
  if (!input.length || input.toLowerCase() === "all") {
    return fallback;
  }

  const resolved = input
    .split(",")
    .map((item) => normalizeRoleId(item))
    .filter((roleId) => roleId !== null && USER_MANAGEMENT_ROLE_IDS.includes(roleId));

  return resolved.length ? Array.from(new Set(resolved)) : fallback;
};

const normalizeRoleId = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return null;
    }

    const numeric = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }

    const alias = ROLE_ALIAS_MAP.get(trimmed.toLowerCase());
    if (alias) {
      return alias;
    }
  }

  return null;
};

const GENDER_CANONICAL_MAP = new Map([
  ["male", "Male"],
  ["female", "Female"],
]);

const ALLOWED_GENDERS = new Set(GENDER_CANONICAL_MAP.values());
const NULLISH_GENDER_VALUES = new Set([
  "",
  "na",
  "n/a",
  "none",
  "null",
  "not specified",
  "unspecified",
  "unknown",
  "prefer not to say",
  "prefer not",
  "not set",
]);

const sanitizeGender = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed.length) {
    return null;
  }

  const normalized = trimmed.toLowerCase();

  if (NULLISH_GENDER_VALUES.has(normalized)) {
    return null;
  }

  if (GENDER_CANONICAL_MAP.has(normalized)) {
    return GENDER_CANONICAL_MAP.get(normalized);
  }

  return null;
};

const sanitizeContactNumber = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized.length) {
    return null;
  }

  const digitsOnly = normalized.replace(/\D/g, "");
  if (!digitsOnly.length) {
    return null;
  }

  return digitsOnly;
};

const generateTemporaryPassword = (length = 12) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  if (length <= 0) {
    return "Temp#1234";
  }

  const randomBytes = crypto.randomBytes(length);
  let password = "";

  for (let index = 0; index < length; index += 1) {
    const charIndex = randomBytes[index] % alphabet.length;
    password += alphabet[charIndex];
  }

  return password;
};

const attemptLog = async (payload) => {
  try {
    await logService.add(payload);
  } catch (logError) {
    console.error("failed to record admin user log", logError);
  }
};

const maskContactNumberSafe = (value) => {
  if (!value) {
    return null;
  }

  const digits = String(value).replace(/\D+/g, "");
  if (!digits.length) {
    return null;
  }

  if (digits.length <= 3) {
    return "*".repeat(Math.max(0, digits.length - 1)) + digits.slice(-1);
  }

  const visible = digits.slice(-2);
  return `${"*".repeat(digits.length - visible.length)}${visible}`;
};

// create a new user
export const createUser = async (req, res, next) => {
  const {
    firstname,
    lastname,
    birthday,
    gender,
    email,
    contactNumber,
    password,
  } = req.body;

  const roleCandidates = [
    req.body.roleId,
    req.body.roleID,
    req.body.roleid,
    req.body.role,
  ];

  let requestedRoleId = null;
  for (const candidate of roleCandidates) {
    const normalized = normalizeRoleId(candidate);
    if (normalized !== null) {
      requestedRoleId = normalized;
      break;
    }
  }

  const requesterRoleId = normalizeRoleId(req.user?.roleID ?? req.user?.roleid);
  const targetRoleId = requestedRoleId ?? ROLES.TECHNICIAN;
  const roleLabel = ROLE_LABELS.get(targetRoleId) ?? "User";
  const roleLabelLower = roleLabel.toLowerCase();

  try {
    if (!firstname || !lastname || !email || !password) {
      return handleResponse(res, 400, "firstname, lastname, email, and password are required");
    }

    if (!CREATABLE_ROLES.has(targetRoleId)) {
      return handleResponse(res, 400, "invalid role provided");
    }

    if (requesterRoleId !== ROLES.SUPERADMIN && targetRoleId !== ROLES.TECHNICIAN) {
      return handleResponse(res, 403, "only super administrators can assign roles other than technician");
    }

    const sanitizedEmail = email.trim().toLowerCase();

    const existing = await userService.fetchUserByEmailService(sanitizedEmail);
    if (existing) {
      return handleResponse(res, 409, "email is already taken");
    }

    const hashedPassword = await hashPassword(password);
    const normalizedGender = sanitizeGender(gender);
    if (!ALLOWED_GENDERS.has(normalizedGender) && normalizedGender !== null) {
      return handleResponse(res, 400, "gender must be male or female");
    }

    const newUser = await createUserService(
      targetRoleId,
      firstname.trim(),
      lastname.trim(),
      birthday,
      normalizedGender,
      sanitizedEmail,
      sanitizeContactNumber(contactNumber),
      hashedPassword
    );

    await sendVerificationCode(newUser).catch((error) =>
      console.error(`failed to send verification code for ${roleLabelLower} account`, error)
    );

    // log the action
    await attemptLog({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "CREATE_USER",
      targetTable: "users",
      targetId: newUser.userid,
      details: {
        summary: `${roleLabel} account created`,
        assignedRoleId: targetRoleId,
        emailMasked: maskEmail(newUser.email),
        contactMasked: maskContactNumberSafe(newUser.contactnumber ?? null),
      },
    });

    return handleResponse(res, 201, `${roleLabel} account created successfully!`, newUser);
  } catch (err) {
    console.error(`failed to create ${roleLabelLower} account`, err);
    return handleResponse(res, 500, `failed to create ${roleLabelLower} account`, {
      error: err.message,
    });
  }
};

// fetch user by id
export const fetchUserById = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const user = await fetchUserbyIdService(userId);

    if (!user || user.roleid !== ROLES.TECHNICIAN) {
      return handleResponse(res, 404, "technician not found");
    }

    const { password: _password, ...safeUser } = user;

    return handleResponse(res, 200, "technician fetched successfully", safeUser);
  } catch (err) {
    console.error("failed to fetch technician", err);
    return handleResponse(res, 500, "failed to fetch technician", {
      error: err.message,
    });
  }
};

// update user
export const updateUser = async (req, res, next) => {
  const { firstname, lastname, birthday, gender, email, contactNumber, bio, password } = req.body;

  const roleCandidates = [req.body.roleId, req.body.roleID, req.body.roleid, req.body.role];
  let requestedRoleId = null;
  for (const candidate of roleCandidates) {
    const normalized = normalizeRoleId(candidate);
    if (normalized !== null) {
      requestedRoleId = normalized;
      break;
    }
  }

  const requesterRoleId = normalizeRoleId(req.user?.roleID ?? req.user?.roleid);
  const isSuperAdmin = requesterRoleId === ROLES.SUPERADMIN;

  try {
    const targetId = req.params.id;
    const existing = await fetchUserbyIdService(targetId);

    const allowedRoles = isSuperAdmin ? USER_MANAGEMENT_ROLE_IDS : [ROLES.TECHNICIAN];

    if (!existing || !allowedRoles.includes(existing.roleid)) {
      return handleResponse(res, 404, isSuperAdmin ? "user not found" : "technician not found");
    }

    if (requestedRoleId !== null) {
      if (!CREATABLE_ROLES.has(requestedRoleId)) {
        return handleResponse(res, 400, "invalid role provided");
      }

      if (!isSuperAdmin && requestedRoleId !== existing.roleid) {
        return handleResponse(res, 403, "only super administrators can reassign roles");
      }

      if (isSuperAdmin && !USER_MANAGEMENT_ROLE_IDS.includes(requestedRoleId)) {
        return handleResponse(res, 400, "role is not supported in user management");
      }
    }

    const existingEmailLower = existing.email?.toLowerCase() ?? "";
    const nextEmail = email?.trim().toLowerCase() ?? existingEmailLower;

    if (nextEmail !== existingEmailLower) {
      const duplicate = await userService.fetchUserByEmailService(nextEmail);
      if (duplicate && duplicate.userid !== Number(targetId)) {
        return handleResponse(res, 409, "email is already taken");
      }
    }

    const hasGender = Object.prototype.hasOwnProperty.call(req.body, "gender");
    const sanitizedExistingGender = sanitizeGender(existing.gender);
    const sanitizedIncomingGender = sanitizeGender(gender);
    const nextGender = hasGender ? sanitizedIncomingGender : sanitizedExistingGender;
    if (nextGender !== null && !ALLOWED_GENDERS.has(nextGender)) {
      return handleResponse(res, 400, "gender must be male or female");
    }

    const hasContactNumber = Object.prototype.hasOwnProperty.call(req.body, "contactNumber");
    const sanitizedExistingContact = sanitizeContactNumber(existing.contactnumber);
    const sanitizedIncomingContact =
      contactNumber === null
        ? null
        : sanitizeContactNumber(contactNumber);
    const wantsExplicitNull = hasContactNumber && contactNumber === null;

    // ...existing code...

    const nextContactNumber = hasContactNumber
      ? wantsExplicitNull
        ? null
        : sanitizedIncomingContact && sanitizedIncomingContact.length > 0
          ? sanitizedIncomingContact
          : sanitizedExistingContact
      : sanitizedExistingContact;

    const roleUpdate = isSuperAdmin ? requestedRoleId : null;
    const hasBio = Object.prototype.hasOwnProperty.call(req.body, "bio");
    const nextBio = hasBio ? (bio ?? "").toString().trim() : existing.bio;

    const user = await updateUserService(
      targetId,
      firstname?.trim() ?? existing.firstname,
      lastname?.trim() ?? existing.lastname,
      birthday ?? existing.birthday,
      nextGender,
      nextEmail,
      nextContactNumber,
      nextBio,
      password,
      null,
      roleUpdate
    );

    if (!user) {
      return handleResponse(res, 404, "user not found");
    }

    const updatedRoleLabel = ROLE_LABELS.get(user.roleid) ?? "User";

    await attemptLog({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "UPDATE_USER",
      targetTable: "users",
      targetId: user.userid,
      details: {
        summary: `${updatedRoleLabel} account updated`,
        updatedFields: Object.keys(req.body ?? {}),
        roleChange:
          roleUpdate && roleUpdate !== existing.roleid
            ? { from: existing.roleid, to: roleUpdate }
            : undefined,
      },
    });

    return handleResponse(res, 200, `${updatedRoleLabel} account updated successfully`, user);
  } catch (err) {
    console.error("failed to update user", err);
    return handleResponse(res, 500, "failed to update user", {
      error: err.message,
    });
  }
};

// delete user
export const deleteUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const existing = await fetchUserbyIdService(targetId);
    const requesterRoleId = normalizeRoleId(req.user?.roleID ?? req.user?.roleid);
    const isSuperAdmin = requesterRoleId === ROLES.SUPERADMIN;
    const allowedRoles = isSuperAdmin ? USER_MANAGEMENT_ROLE_IDS : [ROLES.TECHNICIAN];

    if (!existing || !allowedRoles.includes(existing.roleid)) {
      return handleResponse(res, 404, isSuperAdmin ? "user not found" : "technician not found");
    }

    const user = await deleteUserService(targetId);

    if (!user) {
      return handleResponse(res, 404, "user not found");
    }

    // log the deletion
    await attemptLog({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "DELETE_USER",
      targetTable: "users",
      targetId: user.userid,
      details: {
        summary: "Account deleted",
        deletedRoleId: user.roleid,
        emailMasked: maskEmail(user.email),
      },
    });

    const { password: _password, ...safeUser } = user;

    const deletedRoleLabel = ROLE_LABELS.get(existing.roleid) ?? "User";

    return handleResponse(res, 200, `${deletedRoleLabel} account deleted successfully`, safeUser);
  } catch (err) {
    console.error("failed to delete user", err);
    return handleResponse(res, 500, "failed to delete user", {
      error: err.message,
    });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const targetId = req.params.id;
    const technician = await fetchUserbyIdService(targetId);

    if (!technician || !USER_MANAGEMENT_ROLE_IDS.includes(technician.roleid)) {
      return handleResponse(res, 404, "user not found");
    }

    if (!technician.email) {
      return handleResponse(res, 400, "user does not have an email address on file");
    }

    const result = await sendVerificationCode(technician, true);

    await attemptLog({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "RESEND_VERIFICATION_EMAIL",
      targetTable: "users",
      targetId: technician.userid,
      details: {
        summary: "Verification link reissued",
        technicianId: technician.userid,
        emailMasked: maskEmail(technician.email),
        emailDelivery: "sent",
      },
    });

    return handleResponse(res, 200, "verification email sent successfully", {
      email: technician.email,
      verificationUrl: result?.verificationUrl ?? null,
    });
  } catch (error) {
    const targetId = Number.parseInt(req.params.id, 10) || null;

    if (error instanceof EmailDeliveryError) {
      await attemptLog({
        userId: req.user?.id || null,
        roleId: req.user?.roleID || null,
        action: "RESEND_VERIFICATION_EMAIL",
        targetTable: "users",
        targetId,
        details: {
          summary: "Verification link generated without email delivery",
          emailDelivery: "failed",
          fallbackLinkProvided: Boolean(error.verificationUrl),
        },
      });

      return handleResponse(res, 202, "verification link generated but email delivery failed", {
        verificationUrl: error.verificationUrl,
      });
    }

    console.error("failed to resend verification email", error);

    await attemptLog({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "RESEND_VERIFICATION_EMAIL",
      targetTable: "users",
      targetId,
      details: {
        summary: "Verification link request recorded with degraded response",
        emailDelivery: "unknown",
        error: error?.message,
      },
    }).catch(() => {});

    return handleResponse(res, 202, "verification link request recorded; share manual link if provided", {
      verificationUrl: error?.verificationUrl ?? null,
      error: error?.message,
    });
  }
};

const PASSWORD_RESETTABLE_ROLES = new Set([ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.TECHNICIAN]);

export const resetTechnicianPassword = async (req, res) => {
  try {
    const targetId = req.params.id;
    const user = await fetchUserbyIdService(targetId);

    if (!user || !PASSWORD_RESETTABLE_ROLES.has(user.roleid)) {
      return handleResponse(res, 404, "user not found");
    }

    const temporaryPassword = generateTemporaryPassword(12);
    const hashedPassword = await hashPassword(temporaryPassword);
    await updatePasswordService(targetId, hashedPassword);

    await attemptLog({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "ISSUE_TEMPORARY_PASSWORD",
      targetTable: "users",
      targetId: user.userid,
      details: {
        summary: "Temporary password issued",
        targetRoleId: user.roleid,
        userId: user.userid,
        emailMasked: maskEmail(user.email),
      },
    });

    return handleResponse(res, 200, "temporary password generated successfully", {
      temporaryPassword,
    });
  } catch (error) {
    console.error("failed to reset technician password", error);
    return handleResponse(res, 500, "failed to reset password", {
      error: error.message,
    });
  }
};

// fetch all users
export const fetchAllUsers = async (req, res, next) => {
  try {
    const {
      search,
      status,
      verified,
      gender,
      sortBy,
      sortOrder,
      page,
      pageSize,
      createdFrom,
      createdTo,
      roles,
    } = req.query;

    const requesterRoleId = normalizeRoleId(req.user?.roleID ?? req.user?.roleid);
    const isSuperAdmin = requesterRoleId === ROLES.SUPERADMIN;

    const defaultRoles = isSuperAdmin ? USER_MANAGEMENT_ROLE_IDS : [ROLES.TECHNICIAN];
    const roleIds = isSuperAdmin ? parseRoleFilter(roles, defaultRoles) : defaultRoles;

    const result = await fetchTechniciansService({
      search,
      gender: gender && gender.toLowerCase() !== "all" ? gender : undefined,
      verified: verified ?? status,
      sortBy,
      sortOrder,
      page,
      pageSize,
      createdFrom,
      createdTo,
      roleIds,
    });

    const entityLabel = isSuperAdmin ? "user" : "technician";

    return handleResponse(res, 200, `${entityLabel} accounts fetched successfully`, result);
  } catch (err) {
    console.error("failed to list users", err);
    return handleResponse(res, 500, "failed to list users", {
      error: err.message,
    });
  }
};

export const fetchRoleSummary = async (req, res) => {
  try {
    const requesterRoleId = normalizeRoleId(req.user?.roleID ?? req.user?.roleid);
    if (requesterRoleId !== ROLES.SUPERADMIN) {
      return handleResponse(res, 403, "only super administrators can access role summary");
    }

    const roleIds = parseRoleFilter(req.query.roles);

    const result = await fetchTechniciansService({
      roleIds,
      page: 1,
      pageSize: 1,
    });

    const payload = {
      total: result.pagination?.total ?? 0,
      summary: {
        verified: result.summary?.verified ?? 0,
        unverified: result.summary?.unverified ?? 0,
        roleCounts: result.summary?.roleCounts ?? {},
      },
    };

    return handleResponse(res, 200, "role summary fetched successfully", payload);
  } catch (err) {
    console.error("failed to fetch role summary", err);
    return handleResponse(res, 500, "failed to fetch role summary", {
      error: err.message,
    });
  }
};

// get current logged-in user
export const getCurrentUser = async (req, res) => {
  try {
    const resolvedId = normalizeUserId(
      req.user?.id ?? req.user?.userId ?? req.user?.userid ?? req.user?.user_id ?? null
    );

    if (resolvedId === null) {
      return handleResponse(res, 400, "session user id is invalid");
    }

    let user = null;

    try {
      user = await fetchUserbyIdService(resolvedId);
    } catch (serviceError) {
      if (serviceError instanceof DatabaseUnavailableError) {
        console.warn(
          "database unavailable while resolving current user, serving session cache",
          serviceError?.cause ?? serviceError
        );

        const fallbackFirstName =
          req.user?.firstname ??
          req.user?.firstName ??
          (typeof req.user?.name === "string" ? req.user.name.split(" ")[0] : null) ??
          "Admin";

        const fallbackLastName =
          req.user?.lastname ??
          req.user?.lastName ??
          (typeof req.user?.name === "string" ? req.user.name.split(" ").slice(1).join(" ") : null) ??
          "";

        const fallbackPayload = {
          userid: resolvedId,
          id: resolvedId,
          firstname: fallbackFirstName,
          lastname: fallbackLastName,
          email: req.user?.email ?? null,
          roleid: normalizeRoleId(req.user?.roleID ?? req.user?.roleid ?? null),
          roleID: normalizeRoleId(req.user?.roleID ?? req.user?.roleid ?? null),
          is_verified:
            typeof req.user?.verified === "boolean"
              ? req.user.verified
              : null,
          profileimg: null,
          __meta: {
            hydratedFrom: "session",
          },
        };

        return handleResponse(res, 200, "user retrieved from session cache", fallbackPayload);
      }

      throw serviceError;
    }

    if (!user) {
      return handleResponse(res, 404, "user not found");
    }

    const { password, ...userData } = user;
    return handleResponse(res, 200, "user retrieved successfully", userData);
  } catch (error) {
    console.error('error fetching user:', error);
    return handleResponse(res, 500, "server error");
  }
};