import { body } from "express-validator";

export const loginValidation = [
  body("email")
    .isEmail().withMessage("Valid email is required.")
    .normalizeEmail(),
  
  body("password")
    .notEmpty().withMessage("Password is required."),
];