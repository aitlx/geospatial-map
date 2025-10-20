import express from "express"
import { getBarangayMetrics, getBarangayYieldSnapshots } from "../controllers/geospatialController.js"

const router = express.Router()

router.get("/geospatial/barangay-snapshots", getBarangayYieldSnapshots)
router.get("/geospatial/barangays/:barangayId/metrics", getBarangayMetrics)

export default router
