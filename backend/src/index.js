  import express from 'express';
  import cors from 'cors';
  import dotenv from 'dotenv';
  import pool from './config/db.js';
  import fs from 'fs';
  import cookieParser from 'cookie-parser';


  import userRoutes from "./routes/userRoutes.js"
  import authRoute from './routes/authRoute.js';
  import cropRoutes from './routes/cropRoutes.js';
  import barangayYieldsRoute from "./routes/barangayYieldsRoute.js";
  import profileRoutes from './routes/profileRoutes.js';
  import cropPriceRoutes from './routes/barangayCropPriceRoute.js';
  import approvalRoutes from './routes/approvalRoutes.js';
  import barangayRoute from './routes/barangayRoute.js';
  import logRoutes from './routes/logRoutes.js';

  dotenv.config();

  const app = express();
  const PORT = process.env.PORT || 5000;


  const uploadDir = "./uploads";
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }


  // middleware
  app.use(cors({
    origin: 'http://localhost:5173', //frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }));

  app.use(cookieParser()); 

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));


  //routes 
  app.use("/api", userRoutes)
  app.use("/api/auth", authRoute);
  app.use("/api/crops", cropRoutes);
  app.use("/api/barangay-yields", barangayYieldsRoute);
  app.use("/api/profile", profileRoutes);
  app.use("/api", cropPriceRoutes);
  app.use("/api/approvals", approvalRoutes);
  app.use("/api/barangays", barangayRoute);
  app.use("/api/logs", logRoutes);

  app.use('/uploads', express.static('uploads')); //serve static files

  // test route
  app.get('/', (req, res) => {
    res.send('API is running...');
  });


  app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);

  });