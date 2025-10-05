import express from "express"
import { getBestRecommendation, listRecommendations } from "../controllers/recommendationController.js"

const router = express.Router()

router.get("/", listRecommendations)
router.get("/barangays/:barangayId/best", getBestRecommendation)

export default router
