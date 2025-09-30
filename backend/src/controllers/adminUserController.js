import userService from "../services/userService.js";
import { handleResponse } from "../utils/handleResponse.js";
import { logService } from "../services/logService.js";

const { 
  createUserService, 
  fetchAllUsersService, 
  deleteUserService, 
  fetchUserbyIdService, 
  updateUserService 
} = userService;

// create a new user
export const createUser = async (req, res, next) => {
  const { roleID, firstname, lastname, birthday, gender, email, contactNumber, password } = req.body;

  try {
    const newUser = await createUserService(
      roleID, firstname, lastname, birthday, gender, email, contactNumber, password
    );

    // log the action
    await logService.add({
      userId: req.user?.userid || null,
      roleId: req.user?.roleid || null,
      action: "CREATE_USER",
      targetTable: "users",
      targetId: newUser.userid,
      details: newUser
    });

    return handleResponse(res, 201, "user account created successfully!", newUser);
  } catch (err) {
    next(err);
  }
};

// fetch user by id
export const fetchUserById = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const user = await fetchUserbyIdService(userId);

    if (!user) {
      return handleResponse(res, 404, "user not found");
    }

    return handleResponse(res, 200, "user fetched successfully", user);
  } catch (err) {
    next(err);
  }
};

// update user
export const updateUser = async (req, res, next) => {
  const { firstname, lastname, birthday, gender, email, contactNumber, password } = req.body;

  try {
    const user = await updateUserService(
      req.params.id, firstname, lastname, birthday, gender, email, contactNumber, password
    );

    if (!user) {
      return handleResponse(res, 404, "user not found");
    }

    // log the update
    await logService.add({
      userId: req.user?.userid || null,
      roleId: req.user?.roleid || null,
      action: "UPDATE_USER",
      targetTable: "users",
      targetId: user.userid,
      details: user
    });

    return handleResponse(res, 200, "account information updated successfully", user);
  } catch (err) {
    next(err);
  }
};

// delete user
export const deleteUser = async (req, res, next) => {
  try {
    const user = await deleteUserService(req.params.id);

    if (!user) {
      return handleResponse(res, 404, "user not found");
    }

    // log the deletion
    await logService.add({
      userId: req.user?.userid || null,
      roleId: req.user?.roleid || null,
      action: "DELETE_USER",
      targetTable: "users",
      targetId: user.userid,
      details: user
    });

    return handleResponse(res, 200, "account information deleted successfully", user);
  } catch (err) {
    next(err);
  }
};

// fetch all users
export const fetchAllUsers = async (req, res, next) => {
  try {
    const users = await fetchAllUsersService();
    return handleResponse(res, 200, "users fetched successfully", users);
  } catch (err) {
    next(err);
  }
};

// get current logged-in user
export const getCurrentUser = async (req, res) => {
  try {
    const user = await fetchUserbyIdService(req.user.id);
    
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