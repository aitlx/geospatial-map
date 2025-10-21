export function normalizeMonthValue(month) {
	if (month == null) return null;
	const n = Number(month);
	if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
	return null;
}

export function monthToSeason(month) {
	const m = normalizeMonthValue(month);
	if (m == null) return null;

	// Wet: June (6) - November (11)
	if (m >= 6 && m <= 11) return "Wet";

	// Dry: December (12), January (1) - May (5)
	return "Dry";
}
