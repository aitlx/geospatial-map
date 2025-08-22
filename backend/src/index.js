import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/db.js';


import userRoutes from "./routes/userRoutes.js"
import authRoute from './routes/authRoute.js';
import cropRoutes from './routes/cropRoutes.js';
import barangayYieldsRoute from "./routes/barangayYieldsRoute.js";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;


// middleware
app.use(cors({
  origin: 'http://localhost:5173', //frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());


//routes 
app.use("/api", userRoutes)
app.use("/api/auth", authRoute);
app.use("/api/crops", cropRoutes);
app.use("/api/barangay-yields", barangayYieldsRoute);

// test route
app.get('/', (req, res) => {
  res.send('API is running...');
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);

});