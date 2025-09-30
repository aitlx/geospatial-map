import pool from "../config/db.js";
import { hashPassword } from "../utils/hashPassword.js";

// Fetch all users
const fetchAllUsersService = async () => {
  const result = await pool.query("SELECT * FROM users");
  return result.rows;
};

// Fetch a single user by ID
const fetchUserbyIdService = async (userid) => {
  const result = await pool.query("SELECT * FROM users WHERE userid = $1", [userid]);
  return result.rows[0];
};

// fetch user by email
const fetchUserByEmailService = async (email) => {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0]; // returns user if found, otherwise undefined
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
  plainPassword, 
  profileimg
) => {
  // hash password only if provided
  let hashedPassword = null;
  if (plainPassword) {
    hashedPassword = await hashPassword(plainPassword);
  }

  const result = await pool.query(
    `UPDATE users SET 
      firstname = $1,
      lastname = $2,
      birthday = $3,
      gender = $4,
      email = $5,
      contactnumber = $6,
      password = COALESCE($7, password),
      profileimg = COALESCE($8, profileimg)
    WHERE userid = $9
    RETURNING userid, roleid, firstname, lastname, email, profileimg`,
    [firstname, lastname, birthday, gender, email, contactNumber, hashedPassword, profileimg, userID]
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
