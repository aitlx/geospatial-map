import pool from "../config/db.js";

// Fetch all users
const fetchAllUsersService = async () => {
  const result = await pool.query("SELECT * FROM users");
  return result.rows;
};

// Fetch a single user by ID
const fetchUserbyIdService = async (id) => {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0];
};

// fetch user by email
const fetchUserByEmailService = async (email) => {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0]; // returns user if found, otherwise undefined
};

// create user
const createUserService = async (
  roleID,
  firstname,
  lastname,
  birthday,
  gender,
  email,
  contactNumber,
  password
) => {
  const result = await pool.query(
    `INSERT INTO users 
      (roleID, firstname, lastname, birthday, gender, email, contactNumber, password) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
     RETURNING *`,
    [roleID, firstname, lastname, birthday, gender, email, contactNumber, password]
  );
  return result.rows[0];
};

// update user
const updateUserService = async (
  userID,
  firstname,
  lastname,
  birthday,
  gender,
  email,
  contactNumber,
  password
) => {
  const result = await pool.query(
    `UPDATE users SET 
      firstname = $1,
      lastname = $2,
      birthday = $3,
      gender = $4,
      email = $5,
      contactNumber = $6,
      password = $7
    WHERE userID = $8
    RETURNING *`,
    [firstname, lastname, birthday, gender, email, contactNumber, password, userID]
  );
  return result.rows[0];
};

// delete user
const deleteUserService = async (userID) => {
  const result = await pool.query(
    `DELETE FROM users WHERE userID = $1 RETURNING *`,
    [userID]
  );
  return result.rows[0];
};

// export as userService object
const userService = {
  fetchAllUsersService,
  fetchUserbyIdService,
  fetchUserByEmailService,
  createUserService,
  updateUserService,
  deleteUserService,
};

export default userService;
