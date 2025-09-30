import { body } from "express-validator";

// validation rules for user registration
export const registerValidation = [
  body("firstName")
    .trim()
    .notEmpty().withMessage("First name is required."),
  
  body("lastName")
    .trim()
    .notEmpty().withMessage("Last name is required."),
  
  body("birthday")
    .isDate().withMessage("Valid birthday is required."),
  
  body("gender")
    .isIn(["Male", "Female", "Other"]) 
    .withMessage("Invalid gender selection."),
  
  body("email")
    .isEmail().withMessage("Valid email is required.")
    .normalizeEmail(),
  
  body("contactNumber")
    .trim()
    .isLength({ min: 10 }).withMessage("Valid contact number required."),
  
  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters long.")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter.")
    .matches(/[0-9]/).withMessage("Password must contain at least one number.")
    .matches(/[\W_]/).withMessage("Password must contain at least one special character."),
  
  body("confirmPassword")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match.");
      }
      return true;
    }),
];

// validation rules for login
export const loginValidation = [
  body("email")
    .isEmail().withMessage("Valid email is required.")
    .normalizeEmail(),
  
  body("password")
    .notEmpty().withMessage("Password is required."),
];