# Crop Recommendation Model Training

This folder hosts the training pipeline for the barangay crop recommendation model.

## Requirements

Install the dependencies listed in `requirements.txt` (preferably inside a virtual environment):

```powershell
cd c:/geospatial-map/ml
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

The script loads PostgreSQL credentials from environment variables. You can either export the standard `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` variables or provide overrides via CLI flags.

## Training workflow

Run the trainer directly with Python:

```powershell
cd c:/geospatial-map/ml
python train_model.py --years 5 --n-estimators 400
```

Key steps performed by the script:

1. Pulls the latest five years of approved yield and price records from the database.
2. Engineers an `expected_revenue` feature and labels the top crop per barangay-season-year.
3. Splits the data into training and holdout sets (using the most recent year when possible).
4. Builds a preprocessing + Random Forest pipeline (one-hot encoding for categorical inputs).
5. Fits the model, evaluates accuracy/F1, and exports reusable artifacts.

## Latest run (2025-10-04)

- Training accuracy: 0.944
- Training F1 score: 0.844
- Test accuracy: 0.861
- Test F1 score: 0.598
- Artifacts: `models/random_forest_recommendation_20251004_211237.joblib` and matching metadata JSON.

The metadata file includes a preview of top recommendations per barangay-season for quick inspection.

## Using the artifacts

Load the saved pipeline in your API layer to serve recommendations:

```python
import joblib
from pathlib import Path

model_path = Path("ml/models/random_forest_recommendation_20251004_211123.joblib")
pipeline = joblib.load(model_path)
```

Feed the pipeline a DataFrame with the same feature columns described in the metadata (`barangay_id`, `season`, `crop_id`, `year`, `total_yield`, `total_area_planted_ha`, `yield_per_hectare`, `avg_price_per_kg`). Then sort the resulting `predict_proba` scores to surface the best crops per barangay-season.
