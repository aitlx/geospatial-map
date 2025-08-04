import  userService from "../models/userModel.js";

const { createUserService, fetchAllUsersService, deleteUserService, fetchUserbyIdService, updateUserService } = userService;

const handleResponse = (res, status, message, data = null) => {
  res.status(status).json({
    status,
    message,
    data,
  });
};

export const createUser = async (req, res, next) => {
  const { roleID, firstname, lastname, birthday, gender, email, contactNumber, password } = req.body;
  try {
    const newUser = await createUserService(roleID, firstname, lastname, birthday, gender, email, contactNumber, password);
    handleResponse(res, 201, "User account created successfully!", newUser);
  } catch (err) {
    next(err);
  }
};

export const fetchUserById = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const user = await fetchUserbyIdService(userId);

    if (!user) {
      return handleResponse(res, 404, "User not found");
    }

    return handleResponse(res, 200, "User fetched successfully", user);
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  const { firstname, lastname, birthday, gender, email, contactNumber, password } = req.body;

  try {
    const user = await updateUserService(
      req.params.id,
      firstname,
      lastname,
      birthday,
      gender,
      email,
      contactNumber,
      password
    );

    if (!user) {
      return handleResponse(res, 404, "User not found");
    }

    return handleResponse(res, 200, "Account information updated successfully", user);
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await deleteUserService(req.params.id);

    if (!user) {
      return handleResponse(res, 404, "User not found");
    }

    return handleResponse(res, 200, "Account information deleted successfully", user);
  } catch (err) {
    next(err);
  }
};

export const fetchAllUsers = async (req, res, next) => {
  try {
    const users = await fetchAllUsersService();
    handleResponse(res, 200, "Users fetched successfully", users);
  } catch (err) {
    next(err);
  }
};
