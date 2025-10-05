"""Train a Random Forest classifier for barangay crop recommendations.

This script connects directly to the project PostgreSQL database, fetches the
last N years of approved yield and price records, engineers supervision labels
that mark the revenue-leading crop per barangay-season-year, and trains a
Random Forest classifier to predict whether an observed crop configuration is
the "best" choice under those conditions.

The trained model is persisted alongside metadata so the backend API can load
it without additional preprocessing work.
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extensions import connection as PGConnection
from psycopg2.extras import RealDictCursor
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

try:  # Optional helper for local development
	from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
	load_dotenv = None  # type: ignore


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL_DIR = PROJECT_ROOT / "models"
SEASON_MONTH_TO_LABEL = {
	"dry": "Dry",
	"wet": "Wet",
}


@dataclass(frozen=True)
class TrainingArtifacts:
	"""Container describing persisted training outputs."""

	model_path: Path
	metadata_path: Path


def load_env_files() -> None:
	"""Attempt to load environment variables from the repo's .env files."""

	if load_dotenv is None:
		return

	candidate_paths = [
		PROJECT_ROOT / ".env",
		PROJECT_ROOT.parent / ".env",
		PROJECT_ROOT.parent / "backend" / ".env",
	]

	for env_path in candidate_paths:
		if env_path.is_file():
			load_dotenv(env_path, override=False)


def resolve_db_config(args: argparse.Namespace) -> Dict[str, str]:
	"""Resolve Postgres connection settings from CLI overrides or env vars."""

	load_env_files()

	return {
		"host": args.host or os.getenv("PGHOST", "127.0.0.1"),
		"port": args.port or os.getenv("PGPORT", "5432"),
		"database": args.database or os.getenv("PGDATABASE", "geo_agri_db"),
		"user": args.user or os.getenv("PGUSER", "postgres"),
		"password": args.password or os.getenv("PGPASSWORD", "Foracads28@"),
	}


def get_connection(config: Dict[str, str]) -> PGConnection:
	"""Create a psycopg2 connection using the supplied configuration."""

	return psycopg2.connect(**config)


def determine_year_threshold(conn: PGConnection, min_years: int) -> int:
	"""Determine the minimum year to include based on available historical data."""

	sql = """
		SELECT DISTINCT year
		FROM barangay_yields
		WHERE status = 'approved'
		ORDER BY year DESC
	"""

	with conn.cursor(cursor_factory=RealDictCursor) as cursor:
		cursor.execute(sql)
		rows = cursor.fetchall()

	if not rows:
		raise RuntimeError("No approved yield records found in the database.")

	years_available = [int(row["year"]) for row in rows]
	years_available.sort(reverse=True)

	if len(years_available) >= min_years:
		threshold = years_available[min_years - 1]
	else:
		threshold = years_available[-1]

	return threshold


def fetch_training_frame(conn: PGConnection, min_year: int) -> pd.DataFrame:
	"""Fetch joined yield/price history needed for model training."""

	query = """
		WITH yield_data AS (
			SELECT
				y.barangay_id,
				COALESCE(b.adm3_en, CONCAT('Barangay ', y.barangay_id)) AS barangay_name,
				y.crop_id,
				COALESCE(c.crop_name, CONCAT('Crop ', y.crop_id)) AS crop_name,
				y.year,
				LOWER(y.season) AS season,
				y.total_yield,
				y.total_area_planted_ha,
				y.yield_per_hectare
			FROM barangay_yields AS y
			LEFT JOIN barangays AS b USING (barangay_id)
			LEFT JOIN crops AS c USING (crop_id)
			WHERE y.status = 'approved'
			  AND y.year >= %(min_year)s
		), price_data AS (
			SELECT
				p.barangay_id,
				p.crop_id,
				p.year,
				CASE WHEN p.month BETWEEN 6 AND 11 THEN 'wet' ELSE 'dry' END AS season,
				AVG(p.price_per_kg) AS avg_price_per_kg
			FROM barangay_crop_prices AS p
			WHERE p.status = 'approved'
			  AND p.year >= %(min_year)s
			GROUP BY 1, 2, 3, 4
		)
		SELECT
			y.barangay_id,
			y.barangay_name,
			y.crop_id,
			y.crop_name,
			y.year,
			y.season,
			y.total_yield,
			y.total_area_planted_ha,
			y.yield_per_hectare,
			COALESCE(p.avg_price_per_kg, 0) AS avg_price_per_kg
		FROM yield_data AS y
		LEFT JOIN price_data AS p
		  ON p.barangay_id = y.barangay_id
		 AND p.crop_id = y.crop_id
		 AND p.year = y.year
		 AND p.season = y.season
		ORDER BY y.year, y.barangay_id, y.crop_id
	"""

	return pd.read_sql_query(query, conn, params={"min_year": min_year})


def engineer_features(raw_df: pd.DataFrame) -> pd.DataFrame:
	"""Clean raw records and compute helper columns required for training."""

	df = raw_df.copy()
	if df.empty:
		raise RuntimeError("The training query returned no rows.")

	df["season"] = df["season"].str.lower()

	# Fill missing measurements with dataset medians to keep the pipeline simple.
	numeric_cols = ["total_yield", "total_area_planted_ha", "yield_per_hectare", "avg_price_per_kg"]
	for col in numeric_cols:
		if col not in df:
			raise KeyError(f"Expected column '{col}' in training frame.")
		if df[col].isnull().all():
			df[col] = 0

	# Reconstruct yield_per_hectare when absent.
	mask_missing_yield = df["yield_per_hectare"].isna()
	if mask_missing_yield.any():
		safe_area = df.loc[mask_missing_yield, "total_area_planted_ha"].replace(0, np.nan)
		df.loc[mask_missing_yield, "yield_per_hectare"] = (
			df.loc[mask_missing_yield, "total_yield"] / safe_area
		)

	# Replace lingering NaNs with medians.
	for col in numeric_cols:
		median_value = df[col].dropna().median()
		df[col] = df[col].fillna(median_value if not np.isnan(median_value) else 0)

	# Stabilise area by avoiding zeros.
	df["total_area_planted_ha"] = df["total_area_planted_ha"].replace(0, df["total_area_planted_ha"].median())

	df["expected_revenue"] = df["yield_per_hectare"] * df["avg_price_per_kg"]

	return df


def label_best_crops(df: pd.DataFrame) -> pd.DataFrame:
	"""Add a binary label indicating the top crop per barangay-season-year."""

	grouped = df.groupby(["barangay_id", "year", "season"])
	df["max_revenue_in_group"] = grouped["expected_revenue"].transform("max")
	df["is_top_crop"] = (df["expected_revenue"] >= df["max_revenue_in_group"]).astype(int)
	df = df.drop(columns=["max_revenue_in_group"])

	positives = df["is_top_crop"].sum()
	if positives == 0:
		raise RuntimeError("Label engineering produced zero positive samples. Check data quality.")

	return df


def split_datasets(df: pd.DataFrame, random_state: int) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
	"""Create train/test splits, reserving the most recent year as holdout when possible."""

	feature_cols = [
		"barangay_id",
		"season",
		"crop_id",
		"year",
		"total_yield",
		"total_area_planted_ha",
		"yield_per_hectare",
		"avg_price_per_kg",
	]

	latest_year = int(df["year"].max())
	train_mask = df["year"] < latest_year
	has_holdout = train_mask.any() and (~train_mask).any()

	if has_holdout and df.loc[~train_mask, "is_top_crop"].nunique() == 2:
		train_df = df.loc[train_mask].reset_index(drop=True)
		test_df = df.loc[~train_mask].reset_index(drop=True)
	else:
		train_df, test_df = train_test_split(
			df,
			test_size=0.2,
			stratify=df["is_top_crop"] if df["is_top_crop"].nunique() > 1 else None,
			random_state=random_state,
		)
		train_df = train_df.reset_index(drop=True)
		test_df = test_df.reset_index(drop=True)

	X_train = train_df[feature_cols]
	y_train = train_df["is_top_crop"]
	X_test = test_df[feature_cols]
	y_test = test_df["is_top_crop"]

	return X_train, X_test, y_train, y_test


def build_pipeline(random_state: int, n_estimators: int, max_depth: Optional[int]) -> Pipeline:
	"""Construct the preprocessing + Random Forest pipeline."""

	categorical_features = ["barangay_id", "season", "crop_id"]
	numeric_features = ["year", "total_yield", "total_area_planted_ha", "yield_per_hectare", "avg_price_per_kg"]

	try:
		categorical_encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
	except TypeError:
		categorical_encoder = OneHotEncoder(handle_unknown="ignore", sparse=False)  # pragma: no cover - legacy fallback

	preprocessing = ColumnTransformer(
		transformers=[
			("categorical", categorical_encoder, categorical_features),
			("numeric", "passthrough", numeric_features),
		]
	)

	model = RandomForestClassifier(
		n_estimators=n_estimators,
		max_depth=max_depth,
		random_state=random_state,
		n_jobs=-1,
		class_weight="balanced",
	)

	return Pipeline([("preprocess", preprocessing), ("model", model)])


def evaluate_model(pipeline: Pipeline, X: pd.DataFrame, y: pd.Series) -> Dict[str, float]:
	"""Compute classification metrics for the supplied dataset."""

	predictions = pipeline.predict(X)
	accuracy = float(accuracy_score(y, predictions))
	f1 = float(f1_score(y, predictions, zero_division=0))

	report = classification_report(y, predictions, output_dict=True, zero_division=0)

	return {
		"accuracy": accuracy,
		"f1": f1,
		"report": report,
	}


def generate_recommendations(
	pipeline: Pipeline,
	df: pd.DataFrame,
	feature_cols: Iterable[str],
	top_k: int = 3,
) -> List[Dict[str, object]]:
	"""Return top-k recommended crops per barangay/season using model probabilities."""

	working = df.copy()
	working["probability"] = pipeline.predict_proba(working[list(feature_cols)])[:, 1]

	latest_year = int(working["year"].max())
	latest = working[working["year"] == latest_year]

	recommendations: List[Dict[str, object]] = []
	for (barangay_id, season), group in latest.groupby(["barangay_id", "season"]):
		top_group = group.sort_values(["probability", "expected_revenue"], ascending=False).head(top_k)
		for rank, row in enumerate(top_group.itertuples(index=False), start=1):
			recommendations.append(
				{
					"barangay_id": int(row.barangay_id),
					"barangay_name": row.barangay_name,
					"season": SEASON_MONTH_TO_LABEL.get(row.season, row.season.title()),
					"crop_id": int(row.crop_id),
					"crop_name": row.crop_name,
					"year": int(row.year),
					"probability": float(row.probability),
					"expected_revenue": float(row.expected_revenue),
					"rank": rank,
				}
			)

	return recommendations


def persist_artifacts(
	pipeline: Pipeline,
	metadata: Dict[str, object],
	save_dir: Path,
) -> TrainingArtifacts:
	"""Persist the trained pipeline and metadata JSON."""

	save_dir.mkdir(parents=True, exist_ok=True)

	timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
	model_path = save_dir / f"random_forest_recommendation_{timestamp}.joblib"
	metadata_path = save_dir / f"random_forest_recommendation_{timestamp}.json"

	joblib.dump(pipeline, model_path)

	with metadata_path.open("w", encoding="utf-8") as f:
		json.dump(metadata, f, indent=2)

	return TrainingArtifacts(model_path=model_path, metadata_path=metadata_path)


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(description="Train Random Forest crop recommendations.")
	parser.add_argument("--years", type=int, default=5, help="Number of most recent years to include (minimum 2).")
	parser.add_argument("--n-estimators", type=int, default=300, help="Number of trees in the forest.")
	parser.add_argument("--max-depth", type=int, default=None, help="Optional maximum tree depth.")
	parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility.")
	parser.add_argument("--save-dir", type=Path, default=DEFAULT_MODEL_DIR, help="Directory to store model artifacts.")
	parser.add_argument("--host", type=str, default=None, help="PostgreSQL host override.")
	parser.add_argument("--port", type=str, default=None, help="PostgreSQL port override.")
	parser.add_argument("--database", type=str, default=None, help="PostgreSQL database name override.")
	parser.add_argument("--user", type=str, default=None, help="PostgreSQL user override.")
	parser.add_argument("--password", type=str, default=None, help="PostgreSQL password override.")
	return parser.parse_args()


def main() -> None:
	args = parse_args()

	if args.years < 2:
		raise SystemExit("--years must be at least 2 to create meaningful train/test splits.")

	db_config = resolve_db_config(args)

	with get_connection(db_config) as conn:
		min_year = determine_year_threshold(conn, args.years)
		raw_df = fetch_training_frame(conn, min_year)

	engineered_df = engineer_features(raw_df)
	labeled_df = label_best_crops(engineered_df)

	X_train, X_test, y_train, y_test = split_datasets(labeled_df, random_state=args.seed)

	pipeline = build_pipeline(
		random_state=args.seed,
		n_estimators=args.n_estimators,
		max_depth=args.max_depth,
	)

	pipeline.fit(X_train, y_train)

	train_metrics = evaluate_model(pipeline, X_train, y_train)
	test_metrics = evaluate_model(pipeline, X_test, y_test)

	feature_columns = X_train.columns.tolist()
	recommendation_columns = list(dict.fromkeys(feature_columns + [
		"barangay_name",
		"crop_name",
		"expected_revenue",
	]))

	recommendation_view = labeled_df[recommendation_columns].drop_duplicates().reset_index(drop=True)

	recommendations = generate_recommendations(
		pipeline,
		recommendation_view,
		feature_columns,
	)

	metadata = {
		"generated_at_utc": datetime.now(timezone.utc).isoformat(),
		"parameters": {
			"years": args.years,
			"n_estimators": args.n_estimators,
			"max_depth": args.max_depth,
			"random_seed": args.seed,
		},
		"training": {
			"records": int(len(labeled_df)),
			"features": feature_columns,
			"train_metrics": train_metrics,
			"test_metrics": test_metrics,
		},
		"recommendations_preview": recommendations,
	}

	artifacts = persist_artifacts(pipeline, metadata, args.save_dir)

	print("Training complete.")
	print(f"Model saved to: {artifacts.model_path}")
	print(f"Metadata saved to: {artifacts.metadata_path}")
	print("Test accuracy: {:.3f} | Test F1: {:.3f}".format(
		test_metrics["accuracy"], test_metrics["f1"]
	))


if __name__ == "__main__":
	main()

