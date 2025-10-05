import { body } from "express-validator";

export const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("current password is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("new password must be at least 8 characters long")
    .matches(/[A-Z]/)
    .withMessage("new password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("new password must contain at least one number")
    .matches(/[\W_]/)
    .withMessage("new password must contain at least one special character")
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error("new password must be different from current password");
      }
      return true;
    }),
  body("confirmPassword")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("password confirmation does not match new password");
      }
      return true;
    }),
];
