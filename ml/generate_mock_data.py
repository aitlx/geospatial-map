"""Seed mock barangay yield and crop price data for recommendation experiments.

This utility populates the `barangay_yields`, `barangay_crop_prices`, and
`approvals` tables with at least N years (default: 5) of synthetic but
plausible historical records. Generated rows are marked as approved and retain
the submitting technician (`recorded_by_user_id`) so downstream pipelines can
train recommendation models that depend on yield, price, crop, and season
context.

Examples
--------
	$ python generate_mock_data.py --years 6 --seed 2024

	# Dry run to preview what would be inserted
	$ python generate_mock_data.py --dry-run

Notes
-----
* The script automatically skips combinations that already exist for the
  target year range, so it is safe to re-run without duplicating data.
* Database credentials are read from environment variables (PGHOST, PGPORT,
  PGDATABASE, PGUSER, PGPASSWORD). If unset, sensible local defaults are used.
"""

from __future__ import annotations

import argparse
import os
import random
from calendar import monthrange
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence, Tuple

import psycopg2
from psycopg2.extras import execute_values

try:  # Optional dependency – do not fail if missing
	from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional helper
	load_dotenv = None  # type: ignore


DRY_MONTHS = {12, 1, 2, 3, 4, 5}
WET_MONTHS = {6, 7, 8, 9, 10, 11}
SEASON_LABELS = ("Dry", "Wet")


@dataclass(frozen=True)
class Barangay:
	barangay_id: int
	name: str


@dataclass(frozen=True)
class Crop:
	crop_id: int
	name: str


def month_to_season(month: int) -> str:
	if month in WET_MONTHS:
		return "Wet"
	if month in DRY_MONTHS:
		return "Dry"
	raise ValueError(f"Unsupported month value: {month}")


def random_day(year: int, month: int) -> datetime:
	last_day = monthrange(year, month)[1]
	day = random.randint(1, last_day)
	hour = random.randint(6, 17)
	minute = random.randint(0, 59)
	second = random.randint(0, 59)
	return datetime(year, month, day, hour, minute, second)


def infer_price_range(crop_name: str) -> Tuple[float, float]:
	name = crop_name.lower()
	if any(keyword in name for keyword in ("rice", "palay")):
		return 16.0, 45.0
	if "corn" in name:
		return 12.0, 35.0
	if any(keyword in name for keyword in ("mango", "fruit")):
		return 25.0, 80.0
	if "vegetable" in name or "veg" in name:
		return 20.0, 60.0
	return 18.0, 70.0


def infer_yield_profile(crop_name: str) -> Tuple[float, float]:
	name = crop_name.lower()
	if any(keyword in name for keyword in ("rice", "palay")):
		return 4.0, 7.0  # MT/ha
	if "corn" in name:
		return 3.0, 6.0
	if any(keyword in name for keyword in ("sugar", "cane")):
		return 5.0, 8.5
	return 2.5, 6.5


def load_env_files() -> None:
	if load_dotenv is None:
		return

	project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
	# Attempt to load ./ml/.env, then backend/.env, then repository root .env
	candidate_paths = [
		os.path.join(project_root, ".env"),
		os.path.join(project_root, "backend", ".env"),
		os.path.join(project_root, "frontend", ".env"),
	]

	for path in candidate_paths:
		if os.path.isfile(path):
			load_dotenv(path, override=False)


def resolve_db_config(args: argparse.Namespace) -> Dict[str, str]:
	load_env_files()

	return {
		"host": args.host or os.getenv("PGHOST", "127.0.0.1"),
		"port": args.port or os.getenv("PGPORT", "5432"),
		"database": args.database or os.getenv("PGDATABASE", "geo_agri_db"),
		"user": args.user or os.getenv("PGUSER", "postgres"),
		"password": args.password or os.getenv("PGPASSWORD", "Foracads28@"),
	}


def fetch_reference_data(cursor) -> Tuple[List[Barangay], List[Crop], List[int], Optional[int]]:
	cursor.execute("SELECT barangay_id, COALESCE(adm3_en, 'Barangay') FROM barangays ORDER BY barangay_id")
	barangays = [Barangay(row[0], row[1]) for row in cursor.fetchall()]

	cursor.execute("SELECT crop_id, COALESCE(crop_name, 'Crop') FROM crops ORDER BY crop_id")
	crops = [Crop(row[0], row[1]) for row in cursor.fetchall()]

	cursor.execute("SELECT userid FROM users WHERE roleid = 3 ORDER BY userid")
	technicians = [row[0] for row in cursor.fetchall()]

	if not technicians:
		cursor.execute("SELECT userid FROM users ORDER BY userid")
		technicians = [row[0] for row in cursor.fetchall()]

	cursor.execute("SELECT userid FROM users WHERE roleid IN (1, 2) ORDER BY roleid ASC, userid ASC LIMIT 1")
	admin_row = cursor.fetchone()
	admin_user_id = admin_row[0] if admin_row else None

	return barangays, crops, technicians, admin_user_id


def load_existing_keys(
	cursor,
	table: str,
	key_fields: Sequence[str],
	start_year: int,
	end_year: int,
) -> set:
	fields_sql = ", ".join(key_fields)
	sql = f"SELECT {fields_sql} FROM {table} WHERE year BETWEEN %s AND %s"
	cursor.execute(sql, (start_year, end_year))
	keys = set()
	for row in cursor.fetchall():
		keys.add(tuple((value.lower() if isinstance(value, str) else value) for value in row))
	return keys


def generate_yield_record(
	barangay: Barangay,
	crop: Crop,
	year: int,
	season: str,
	technicians: Sequence[int],
) -> Tuple[Tuple, int, datetime]:
	season_key = season.lower()
	season_months = WET_MONTHS if season_key == "wet" else DRY_MONTHS
	month = random.choice(tuple(season_months))
	recorded_by = random.choice(technicians)

	min_yield, max_yield = infer_yield_profile(crop.name)
	yield_per_hectare = round(random.uniform(min_yield, max_yield), 2)
	area = round(random.uniform(3.5, 22.0), 2)
	# Introduce variability while keeping consistent relationship
	variability = random.uniform(0.9, 1.25)
	total_yield = round(area * yield_per_hectare * variability, 2)
	computed_yield_per_ha = round(total_yield / area, 2)

	recorded_at = random_day(year, month)

	yield_values = (
		barangay.barangay_id,
		crop.crop_id,
		year,
		month,
		season,
		total_yield,
		area,
		computed_yield_per_ha,
		recorded_by,
		"approved",
	)

	return yield_values, recorded_by, recorded_at


def generate_price_record(
	barangay: Barangay,
	crop: Crop,
	year: int,
	month: int,
	technicians: Sequence[int],
) -> Tuple[Tuple, int, datetime]:
	season_label = month_to_season(month)
	season = season_label.lower()
	min_price, max_price = infer_price_range(crop.name)
	base_price = random.uniform(min_price, max_price)
	price_per_kg = round(base_price * random.uniform(0.9, 1.15), 2)
	recorded_by = random.choice(technicians)
	recorded_at = random_day(year, month)

	price_values = (
		barangay.barangay_id,
		crop.crop_id,
		price_per_kg,
		year,
		month,
		season,
		recorded_by,
		"approved",
		recorded_at,
	)

	return price_values, recorded_by, recorded_at


def insert_mock_data(
	connection,
	barangays: Sequence[Barangay],
	crops: Sequence[Crop],
	technicians: Sequence[int],
	admin_user_id: Optional[int],
	start_year: int,
	end_year: int,
	dry_run: bool = False,
) -> Dict[str, int]:
	if not barangays:
		raise RuntimeError("No barangays found. Seed barangays before running this script.")
	if not crops:
		raise RuntimeError("No crops found. Seed crops before running this script.")
	if not technicians:
		raise RuntimeError("No users available to attach as submitters.")

	with connection.cursor() as cursor:
		yield_keys = load_existing_keys(cursor, "barangay_yields", ("barangay_id", "crop_id", "year", "season"), start_year, end_year)
		price_keys = load_existing_keys(cursor, "barangay_crop_prices", ("barangay_id", "crop_id", "year", "month"), start_year, end_year)

		insert_yield_sql = (
			"INSERT INTO barangay_yields "
			"(barangay_id, crop_id, year, month, season, total_yield, total_area_planted_ha, "
			" yield_per_hectare, recorded_by_user_id, status) VALUES %s "
			"RETURNING yield_id, recorded_by_user_id"
		)

		insert_price_sql = (
			"INSERT INTO barangay_crop_prices "
			"(barangay_id, crop_id, price_per_kg, year, month, season, recorded_by_user_id, status, date_recorded) VALUES %s "
			"RETURNING price_id, recorded_by_user_id, date_recorded"
		)

		approvals_payload: List[Tuple[str, int, str, int, Optional[int], str, datetime]] = []
		yield_records: List[Tuple] = []
		yield_recorded_at: List[datetime] = []
		price_records: List[Tuple] = []
		price_recorded_at: List[datetime] = []

		inserted_yields = 0
		inserted_prices = 0
		planned_yields = 0
		planned_prices = 0
		skipped_yields = 0
		skipped_prices = 0

		years = list(range(start_year, end_year + 1))

		for barangay in barangays:
			for crop in crops:
				for year in years:
					for season in SEASON_LABELS:
						season_key = season.lower()
						key = (barangay.barangay_id, crop.crop_id, year, season_key)
						if key in yield_keys:
							skipped_yields += 1
							continue

						planned_yields += 1
						yield_values, recorded_by, recorded_at = generate_yield_record(
							barangay, crop, year, season, technicians
						)

						if dry_run:
							continue

						yield_records.append(yield_values)
						yield_recorded_at.append(recorded_at)

					for month in range(1, 13):
						key = (barangay.barangay_id, crop.crop_id, year, month)
						if key in price_keys:
							skipped_prices += 1
							continue

						planned_prices += 1
						price_values, recorded_by, recorded_at = generate_price_record(
							barangay, crop, year, month, technicians
						)

						if dry_run:
							continue

						price_records.append(price_values)
						price_recorded_at.append(recorded_at)

		if not dry_run:
			if yield_records:
				yield_results = execute_values(cursor, insert_yield_sql, yield_records, page_size=500, fetch=True)
				inserted_yields = len(yield_results)
				for (yield_id, recorded_by), recorded_at in zip(yield_results, yield_recorded_at):
					approvals_payload.append(
						(
							"barangay_yields",
							yield_id,
							"approved",
							recorded_by,
							admin_user_id,
							"mock-data seed",
							recorded_at,
						)
					)
			if price_records:
				price_results = execute_values(cursor, insert_price_sql, price_records, page_size=500, fetch=True)
				inserted_prices = len(price_results)
				for (price_id, recorded_by, recorded_at_db), recorded_at in zip(price_results, price_recorded_at):
					performed_at = recorded_at_db or recorded_at
					approvals_payload.append(
						(
							"crop_prices",
							price_id,
							"approved",
							recorded_by,
							admin_user_id,
							"mock-data seed",
							performed_at,
						)
					)
			if approvals_payload:
				approvals_sql = (
					"INSERT INTO approvals (record_type, record_id, status, submitted_by, performed_by, reason, performed_at) "
					"VALUES %s"
				)
				execute_values(cursor, approvals_sql, approvals_payload, page_size=500)

		summary = {
			"planned_yields": planned_yields,
			"planned_prices": planned_prices,
			"inserted_yields": inserted_yields,
			"inserted_prices": inserted_prices,
			"skipped_yields": skipped_yields,
			"skipped_prices": skipped_prices,
			"approvals": len(approvals_payload),
		}

	return summary


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(description="Seed mock barangay yield and crop price data.")
	parser.add_argument("--years", type=int, default=5, help="Number of years of history to seed (minimum 5).")
	parser.add_argument("--seed", type=int, default=2025, help="Random seed for reproducibility.")
	parser.add_argument("--dry-run", action="store_true", help="Preview generation without inserting records.")
	parser.add_argument("--host", type=str, default=None, help="PostgreSQL host override.")
	parser.add_argument("--port", type=str, default=None, help="PostgreSQL port override.")
	parser.add_argument("--database", type=str, default=None, help="PostgreSQL database name override.")
	parser.add_argument("--user", type=str, default=None, help="PostgreSQL user override.")
	parser.add_argument("--password", type=str, default=None, help="PostgreSQL password override.")
	return parser.parse_args()


def main() -> None:
	args = parse_args()

	if args.years < 5:
		raise SystemExit("--years must be at least 5 to satisfy historical requirements.")

	random.seed(args.seed)

	config = resolve_db_config(args)

	connection = psycopg2.connect(**config)
	connection.autocommit = False

	try:
		with connection:
			with connection.cursor() as cursor:
				barangays, crops, technicians, admin_user_id = fetch_reference_data(cursor)

		current_year = datetime.now(timezone.utc).year
		start_year = current_year - (args.years - 1)

		summary = insert_mock_data(
			connection,
			barangays,
			crops,
			technicians,
			admin_user_id,
			start_year,
			current_year,
			dry_run=args.dry_run,
		)

		if not args.dry_run:
			connection.commit()
		else:
			connection.rollback()

		print("Mock data generation complete.")
		print(f"  Barangays processed: {len(barangays)}")
		print(f"  Crops processed    : {len(crops)}")
		print(f"  Yield rows inserted: {summary['inserted_yields']} (skipped {summary['skipped_yields']})")
		print(f"  Price rows inserted: {summary['inserted_prices']} (skipped {summary['skipped_prices']})")
		if args.dry_run:
			print(f"  Yield rows planned : {summary['planned_yields']}")
			print(f"  Price rows planned : {summary['planned_prices']}")
			print("  Mode              : dry run (no database changes)")
	finally:
		connection.close()


if __name__ == "__main__":
	main()
