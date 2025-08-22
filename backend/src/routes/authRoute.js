// routes/authRoute.js
import express from "express";
import cors from "cors";
import { registerUser, loginUser, logoutUser } from "../controllers/authController.js";

const router = express.Router();

// middleware
router.use(cors({
  credentials: true,
  origin: "http://localhost:5173"
}));

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post("/logout", logoutUser);

export default router;
