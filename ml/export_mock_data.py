"""Export the engineered training frame used for crop recommendations into a CSV file.

This utility mirrors the data preparation pipeline from `train_model.py` and
writes the final feature set to disk so downstream tools (dashboards, manual
analysis, QA) can quickly inspect the mock dataset.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from train_model import (
    engineer_features,
    fetch_training_frame,
    get_connection,
    resolve_db_config,
    determine_year_threshold,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export the recommendation training frame as CSV.")
    parser.add_argument(
        "--years",
        type=int,
        default=5,
        help="Number of most recent years to include (minimum 2).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("exports/mock_recommendation_dataset.csv"),
        help="Destination path for the CSV export.",
    )
    parser.add_argument(
        "--include-raw",
        action="store_true",
        help="Also export the raw joined frame prior to feature engineering.",
    )
    return parser.parse_args()


def export_dataset(years: int, output_path: Path, include_raw: bool) -> None:
    if years < 2:
        raise SystemExit("--years must be at least 2 to produce a meaningful dataset.")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    args_namespace = argparse.Namespace(host=None, port=None, database=None, user=None, password=None)
    db_config = resolve_db_config(args_namespace)

    with get_connection(db_config) as conn:
        min_year = determine_year_threshold(conn, years)
        raw_df = fetch_training_frame(conn, min_year)

    engineered_df = engineer_features(raw_df).copy()

    engineered_df.to_csv(output_path, index=False)

    if include_raw:
        raw_path = output_path.with_name(output_path.stem + "_raw" + output_path.suffix)
        raw_df.to_csv(raw_path, index=False)

    print(f"Exported engineered dataset to: {output_path}")
    if include_raw:
        print(f"Exported raw joined dataset to: {raw_path}")


if __name__ == "__main__":
    cli_args = parse_args()
    export_dataset(cli_args.years, cli_args.output, cli_args.include_raw)
