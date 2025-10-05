"""Flask API for serving barangay crop recommendations using the trained model.

Endpoint summary
-----------------
POST /recommend
    Body:
        {
            "barangay_id": int,
            "season": "wet" | "dry",
            "year": int,
            "top_k": int (optional, default 3)
        }
    Response:
        {
            "success": true,
            "model": {"path": str, "loaded_at": str},
            "metadata": {...},
            "predictions": [
                {
                    "rank": 1,
                    "crop_id": 7,
                    "crop_name": "Rice",
                    "probability": 0.92,
                    "score": 92.0,
                    "avg_yield": 4.5,
                    "avg_price": 28.3,
                    "expected_revenue": 127.35
                },
                ...
            ]
        }
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from types import SimpleNamespace
from typing import Dict, Iterable, List, Optional

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request

from train_model import (
    engineer_features,
    generate_recommendations,
    get_connection,
    resolve_db_config,
)

LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.INFO)

PROJECT_ROOT = Path(__file__).resolve().parent
MODELS_DIR = PROJECT_ROOT / "models"
DEFAULT_TOP_K = 3
VALID_SEASONS = {"wet", "dry"}
MODEL_CACHE_LOCK = Lock()
MODEL_CACHE: Dict[str, object] = {
    "pipeline": None,
    "metadata": None,
    "feature_columns": None,
    "model_path": None,
    "loaded_at": None,
}


def _find_latest_model() -> Optional[Path]:
    if not MODELS_DIR.exists():
        return None
    candidates = sorted(MODELS_DIR.glob("random_forest_recommendation_*.joblib"))
    return candidates[-1] if candidates else None


def _load_json_metadata(model_path: Path) -> Dict[str, object]:
    json_path = model_path.with_suffix(".json")
    if not json_path.exists():
        raise FileNotFoundError(f"Missing metadata JSON for model: {json_path}")
    with json_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _load_artifacts() -> None:
    with MODEL_CACHE_LOCK:
        if MODEL_CACHE["pipeline"] is not None:
            return

        model_path = _find_latest_model()
        if model_path is None:
            raise FileNotFoundError("No trained model artifacts found in ml/models.")

        import joblib

        LOGGER.info("Loading recommendation model from %s", model_path)
        pipeline = joblib.load(model_path)
        metadata = _load_json_metadata(model_path)
        feature_columns = metadata.get("training", {}).get("features")
        if not feature_columns:
            raise ValueError("Model metadata is missing the feature column list.")

        MODEL_CACHE.update(
            {
                "pipeline": pipeline,
                "metadata": metadata,
                "feature_columns": feature_columns,
                "model_path": model_path,
                "loaded_at": datetime.now(timezone.utc),
            }
        )


def _get_cached_artifacts():
    _load_artifacts()
    return (
        MODEL_CACHE["pipeline"],
        MODEL_CACHE["metadata"],
        MODEL_CACHE["feature_columns"],
        MODEL_CACHE["model_path"],
        MODEL_CACHE["loaded_at"],
    )


def _resolve_db_config() -> Dict[str, str]:
    args = SimpleNamespace(host=None, port=None, database=None, user=None, password=None)
    return resolve_db_config(args)


DB_CONFIG = _resolve_db_config()


def _season_to_filter(season: str) -> str:
    normalized = (season or "").strip().lower()
    if normalized not in VALID_SEASONS:
        raise ValueError("season must be either 'wet' or 'dry'")
    return normalized


def _determine_target_year(conn, barangay_id: int, season: str, year: int) -> Optional[int]:
    query = """
        SELECT MAX(year) AS latest_year
        FROM barangay_yields
        WHERE status = 'approved'
          AND barangay_id = %s
          AND LOWER(season) = LOWER(%s)
          AND year <= %s
    """
    with conn.cursor() as cursor:
        cursor.execute(query, (barangay_id, season, year))
        row = cursor.fetchone()
        latest_year = row[0] if row else None

    if latest_year is None:
        fallback_query = """
            SELECT MAX(year) AS latest_year
            FROM barangay_yields
            WHERE status = 'approved'
              AND barangay_id = %s
              AND LOWER(season) = LOWER(%s)
        """
        with conn.cursor() as cursor:
            cursor.execute(fallback_query, (barangay_id, season))
            row = cursor.fetchone()
            latest_year = row[0] if row else None

    return latest_year


def _fetch_feature_frame(
    conn,
    barangay_id: int,
    season: str,
    year: int,
) -> pd.DataFrame:
    target_year = _determine_target_year(conn, barangay_id, season, year)
    if target_year is None:
        return pd.DataFrame()

    query = """
        WITH price_lookup AS (
            SELECT
                p.barangay_id,
                p.crop_id,
                p.year,
                AVG(p.price_per_kg) AS avg_price_per_kg
            FROM barangay_crop_prices p
            WHERE p.status = 'approved'
              AND p.barangay_id = %s
              AND ((%s = 'wet' AND p.month BETWEEN 6 AND 11)
                   OR (%s = 'dry' AND (p.month = 12 OR p.month BETWEEN 1 AND 5)))
            GROUP BY p.barangay_id, p.crop_id, p.year
        ), ranked_records AS (
            SELECT
                y.barangay_id,
                COALESCE(b.adm3_en, CONCAT('Barangay ', y.barangay_id)) AS barangay_name,
                y.crop_id,
                COALESCE(c.crop_name, CONCAT('Crop ', y.crop_id)) AS crop_name,
                y.year,
                LOWER(y.season) AS season,
                y.total_yield,
                y.total_area_planted_ha,
                y.yield_per_hectare,
                COALESCE(pl.avg_price_per_kg, 0) AS avg_price_per_kg,
                ROW_NUMBER() OVER (
                    PARTITION BY y.crop_id
                    ORDER BY y.year DESC
                ) AS row_rank
            FROM barangay_yields y
            LEFT JOIN barangays b USING (barangay_id)
            LEFT JOIN crops c USING (crop_id)
            LEFT JOIN price_lookup pl
              ON pl.barangay_id = y.barangay_id
             AND pl.crop_id = y.crop_id
             AND pl.year = y.year
            WHERE y.status = 'approved'
              AND y.barangay_id = %s
              AND LOWER(y.season) = LOWER(%s)
              AND y.year = %s
        )
        SELECT
            barangay_id,
            barangay_name,
            crop_id,
            crop_name,
            %s AS year,
            %s AS season,
            total_yield,
            total_area_planted_ha,
            yield_per_hectare,
            avg_price_per_kg
        FROM ranked_records
        WHERE row_rank = 1
        ORDER BY crop_id
    """

    params = (
        barangay_id,
        season,
        season,
        barangay_id,
        season,
        target_year,
        year,
        season,
    )

    return pd.read_sql_query(query, conn, params=params)


def _prepare_feature_frame(
    df: pd.DataFrame,
    barangay_id: int,
    season: str,
    year: int,
) -> pd.DataFrame:
    if df.empty:
        return df

    engineered = engineer_features(df)
    engineered["year"] = year
    engineered["season"] = season
    engineered["barangay_id"] = barangay_id

    # Ensure numeric stability for the downstream pipeline.
    numeric_cols = [
        "total_yield",
        "total_area_planted_ha",
        "yield_per_hectare",
        "avg_price_per_kg",
        "expected_revenue",
    ]
    for column in numeric_cols:
        if column in engineered:
            engineered[column] = engineered[column].fillna(engineered[column].median()).astype(float)

    return engineered


def _attach_feature_metrics(
    recommendations: List[Dict[str, object]],
    feature_df: pd.DataFrame,
) -> List[Dict[str, object]]:
    if not recommendations or feature_df.empty:
        return recommendations

    feature_index = feature_df.set_index("crop_id")

    enriched = []
    for entry in recommendations:
        crop_id = entry.get("crop_id")
        feature_row = feature_index.loc[crop_id] if crop_id in feature_index.index else None

        result = dict(entry)
        probability = float(result.get("probability", 0))
        result["probability"] = round(probability, 6)
        result["score"] = round(probability * 100, 2)

        if feature_row is not None:
            result["avg_yield"] = float(feature_row.get("yield_per_hectare", np.nan))
            result["avg_price"] = float(feature_row.get("avg_price_per_kg", np.nan))
            result["expected_revenue"] = float(feature_row.get("expected_revenue", np.nan))
        enriched.append(result)

    return enriched


def create_app() -> Flask:
    app = Flask(__name__)

    @app.route("/recommend", methods=["POST"])
    def recommend():
        payload = request.get_json(silent=True) or {}
        try:
            barangay_id = int(payload.get("barangay_id"))
            season = _season_to_filter(payload.get("season"))
            year = int(payload.get("year"))
        except (TypeError, ValueError) as exc:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "Invalid request payload",
                        "details": str(exc),
                    }
                ),
                400,
            )

        top_k_raw = payload.get("top_k", DEFAULT_TOP_K)
        try:
            top_k = int(top_k_raw)
        except (TypeError, ValueError):
            top_k = DEFAULT_TOP_K
        top_k = max(1, min(top_k, 10))

        try:
            pipeline, metadata, feature_columns, model_path, loaded_at = _get_cached_artifacts()
        except Exception as exc:  # pylint: disable=broad-except
            LOGGER.exception("Failed to load model artifacts")
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "Model artifacts unavailable",
                        "details": str(exc),
                    }
                ),
                500,
            )

        try:
            with get_connection(DB_CONFIG) as conn:
                feature_frame = _fetch_feature_frame(conn, barangay_id, season, year)
        except Exception as exc:  # pylint: disable=broad-except
            LOGGER.exception("Failed to fetch features for barangay=%s season=%s year=%s", barangay_id, season, year)
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "Failed to fetch reference data",
                        "details": str(exc),
                    }
                ),
                500,
            )

        if feature_frame.empty:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "No approved data found for the requested barangay/season/year.",
                    }
                ),
                404,
            )

        engineered = _prepare_feature_frame(feature_frame, barangay_id, season, year)
        if engineered.empty:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "Prepared feature frame is empty after preprocessing.",
                    }
                ),
                500,
            )

        try:
            recommendations = generate_recommendations(pipeline, engineered, feature_columns, top_k=top_k)
        except Exception as exc:  # pylint: disable=broad-except
            LOGGER.exception("Failed to generate recommendations")
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "Model inference failed",
                        "details": str(exc),
                    }
                ),
                500,
            )

        enriched = _attach_feature_metrics(recommendations, engineered)

        response = {
            "success": True,
            "model": {
                "path": str(model_path) if isinstance(model_path, Path) else str(model_path),
                "loaded_at": loaded_at.isoformat() if isinstance(loaded_at, datetime) else None,
            },
            "context": {
                "barangay_id": barangay_id,
                "season": season,
                "year": year,
                "rows": len(enriched),
            },
            "metadata": metadata,
            "predictions": enriched,
        }

        return jsonify(response), 200

    @app.route("/health", methods=["GET"])
    def health():
        try:
            _get_cached_artifacts()
            status = 200
            payload = {"success": True, "message": "ready"}
        except Exception as exc:  # pylint: disable=broad-except
            status = 503
            payload = {"success": False, "message": str(exc)}
        return jsonify(payload), status

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
