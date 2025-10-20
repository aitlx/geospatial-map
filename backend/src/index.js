import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/db.js";
import fs from "fs";
import cookieParser from "cookie-parser";

import userRoutes from "./routes/userRoutes.js";
import authRoute from "./routes/authRoute.js";
import cropRoutes from "./routes/cropRoutes.js";
import barangayYieldsRoute from "./routes/barangayYieldsRoute.js";
import profileRoutes from "./routes/profileRoutes.js";
import passwordRoutes from "./routes/passwordRoutes.js";
import cropPriceRoutes from "./routes/barangayCropPriceRoute.js";
import approvalRoutes from "./routes/approvalRoutes.js";
import barangayRoute from "./routes/barangayRoute.js";
import logRoutes from "./routes/logRoutes.js";
import backupRoutes from "./routes/backupRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import recommendationRoutes from "./routes/recommendationRoutes.js";
import topCropsRoutes from "./routes/topCropsRoutes.js";
import geospatialRoutes from "./routes/geospatialRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const uploadDir = "uploads";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// allowlist for cors - includes production and local dev hosts
const allowedOrigins = [
  "https://guagua-geospatial-map.netlify.app/",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (e.g., curl, mobile clients)
      if (!origin) return callback(null, true);
      // strip trailing slash if present
      const normalized = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }
      return callback(new Error("CORS policy: origin not allowed"), false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/favicon.ico", (req, res) => {
  res
    .status(200)
    .type("image/svg+xml")
    .send(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#14b8a6"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#g)"/><path d="M18 33.5c5.5-4.7 9.7-7 15-7 5.3 0 9.5 2.3 15 7-5.5 4.7-9.7 7-15 7-5.3 0-9.5-2.3-15-7z" fill="#ecfdf5"/><circle cx="32" cy="33.5" r="6" fill="#059669"/></svg>`
    );
});

app.use("/api", userRoutes);
app.use("/api/auth", authRoute);
app.use("/api/crops", cropRoutes);
app.use("/api/barangay-yields", barangayYieldsRoute);
app.use("/api/profile", profileRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api", cropPriceRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/barangays", barangayRoute);
app.use("/api/logs", logRoutes);
app.use("/api/backups", backupRoutes);
app.use("/api", notificationRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", geospatialRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/top-crops", topCropsRoutes);

app.use("/uploads", express.static(uploadDir));

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});