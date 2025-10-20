function normalizeMonthValue(month) {
    if (month === null || month === undefined) return null

    if (typeof month === "number" && Number.isFinite(month)) {
        return month
    }

    if (typeof month === "string") {
        const trimmed = month.trim()
        if (!trimmed) return null

        // Support numeric strings and month names (e.g. "June")
        const numericCandidate = Number.parseInt(trimmed, 10)
        if (!Number.isNaN(numericCandidate)) return numericCandidate

        const monthIndex = MONTH_NAME_LOOKUP.get(trimmed.toLowerCase())
        if (typeof monthIndex === "number") return monthIndex
    }

    return null
}

const MONTH_NAME_LOOKUP = new Map(
    [
        ["january", 1],
        ["february", 2],
        ["march", 3],
        ["april", 4],
        ["may", 5],
        ["june", 6],
        ["july", 7],
        ["august", 8],
        ["september", 9],
        ["october", 10],
        ["november", 11],
        ["december", 12],
    ].map(([name, value]) => [name, value])
)

function monthToSeason(month) {
    const numericMonth = normalizeMonthValue(month)
    if (numericMonth === null) return null

    if ([6, 7, 8, 9, 10, 11].includes(numericMonth)) return "wet"
    if ([12, 1, 2, 3, 4, 5].includes(numericMonth)) return "dry"

    return null
}

export { normalizeMonthValue, monthToSeason }
export default monthToSeason