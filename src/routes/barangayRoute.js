import express from 'express';
import { getBarangays, getBarangayDropdown } from '../controllers/barangayController.js';

const router = express.Router();

router.get('/', getBarangays);

router.get('/dropdown', getBarangayDropdown);


export default router;

