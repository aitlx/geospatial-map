import userService from "../models/userModel.js";
import bcrypt from 'bcryptjs';


//register endpoint
export const registerUser = async (req, res, next) => {
  const {
    firstName,
    lastName,
    birthday,
    gender,
    email,
    contactNumber,
    password,
    confirmPassword,
  } = req.body;

  const roleID = 3;

  // Validate input fields
  if (!firstName || !lastName || !birthday || !gender || !email || !contactNumber || !password || !confirmPassword) {
    return res.status(400).json({ err: "All fields are required." });
  }

  if (password.length < 8) {
    return res.status(400).json({ err: "Password must be at least 8 characters long." });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ err: "Passwords do not match." });
  }

  try {
    // check if email already exists
    const existingUser = await userService.fetchUserByEmailService(email);
    if (existingUser && existingUser.length > 0) {
      return res.status(409).json({ err: "Email is already taken." });
    }

    // password hashing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // create new user with hashed password
    const newUser = await userService.createUserService(
      roleID,
      firstName,
      lastName,
      birthday,
      gender,
      email,
      contactNumber,
      hashedPassword // store the hashed password instead of plain text on the db
    );

    return res.status(201).json({
      message: "User account created successfully!",
      user: newUser,
    });
  } catch (err) {
    console.error("Error during registration:", err);
    return res.status(500).json({ err: "Internal server error." });
  }
};


// login endpoint
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ err: "Email and password are required." });

  try {
    const user = await userService.fetchUserByEmailService(email); // 

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ err: "Invalid email or password." });
    }

    res.status(200).json({
      message: "Login successful!",
      user: {
        id: user.userid || user.id, 
        name: `${user.firstname} ${user.lastname}`,
        email: user.email,
        roleID: user.roleid || user.roleID,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ err: "Internal server error." });
  }
};
