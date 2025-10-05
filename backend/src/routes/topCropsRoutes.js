import express from "express"
import { listTopCrops } from "../controllers/topCropsController.js"

const router = express.Router()

router.get("/", listTopCrops)

export default router
