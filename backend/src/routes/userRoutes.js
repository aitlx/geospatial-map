import express from "express";
import {
  createUser,
  fetchAllUsers,
  fetchUserById,
  deleteUser,
  updateUser
} from "../controllers/adminUserController.js"; 

const router = express.Router();

router.post("/user", createUser);
router.get("/user", fetchAllUsers);
router.get("/user/:id", fetchUserById);
router.delete("/user/:id", deleteUser);
router.put("/user/:id", updateUser);

router.get("/", (req, res) => {
  res.send("API is working!");
});


export default router;
