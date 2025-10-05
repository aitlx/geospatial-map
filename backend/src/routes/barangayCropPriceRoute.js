import express from 'express';
import { addCropPrice, fetchCropPrices, fetchCropPriceById, updateCropPrice, deleteCropPrice } from '../controllers/barangayCropPricesController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/barangay-crop-prices', authenticate, addCropPrice);
router.get('/barangay-crop-prices', fetchCropPrices);
router.get('/barangay-crop-prices/:id', fetchCropPriceById);
router.put('/barangay-crop-prices/:id', authenticate, updateCropPrice);
router.delete('/barangay-crop-prices/:id', authenticate, deleteCropPrice);

export default router;

