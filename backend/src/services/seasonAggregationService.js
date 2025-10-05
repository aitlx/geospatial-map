import { monthToSeason, normalizeMonthValue } from "../utils/monthToSeason.js"

const SEASON_KEYS = ["dry", "wet"]

const createEmptySummary = () =>
  SEASON_KEYS.reduce((acc, key) => {
    acc[key] = {
      season: key,
      months: new Set(),
      monthCount: 0,
    }
    return acc
  }, {})

export const seasonAggregationService = {
  aggregateMonths(monthsInput) {
    const summary = createEmptySummary()

    const list = Array.isArray(monthsInput)
      ? monthsInput
      : typeof monthsInput === "string"
      ? monthsInput.split(",")
      : monthsInput === undefined || monthsInput === null
      ? []
      : [monthsInput]

    list.forEach((entry) => {
      const monthValue = normalizeMonthValue(entry)
      if (monthValue === null) return
      const seasonKey = monthToSeason(monthValue)
      if (!seasonKey || !summary[seasonKey]) return

      const seasonSummary = summary[seasonKey]
      seasonSummary.months.add(monthValue)
      seasonSummary.monthCount += 1
    })

    return {
      dry: {
        season: "dry",
        months: Array.from(summary.dry.months).sort((a, b) => a - b),
        monthCount: summary.dry.monthCount,
      },
      wet: {
        season: "wet",
        months: Array.from(summary.wet.months).sort((a, b) => a - b),
        monthCount: summary.wet.monthCount,
      },
      seasons: SEASON_KEYS.filter((key) => summary[key].monthCount > 0),
      totalMonths: summary.dry.monthCount + summary.wet.monthCount,
    }
  },

  deriveSeasonsFromMonths(monthsInput) {
    return this.aggregateMonths(monthsInput).seasons
  },
}

export default seasonAggregationService
