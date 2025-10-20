import pool from "../config/db.js";
import { ROLES } from "../config/roles.js";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizeSeasonKey = (value) => {
  if (!value) return "unspecified";
  const trimmed = String(value).trim().toLowerCase();
  return trimmed.length ? trimmed : "unspecified";
};

const formatSeasonLabel = (key) => {
  const lookup = {
    dry: "Dry",
    wet: "Wet",
    peak: "Peak",
    lean: "Lean",
    summer: "Summer",
    rainy: "Rainy",
    harvest: "Harvest",
    unspecified: "Unspecified",
  };

  if (lookup[key]) return lookup[key];

  return (
    key
      .split(/[\s_-]+/)
      .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : ""))
      .join(" ") || "Unspecified"
  );
};

const normalizeStatusKey = (value) => {
  if (!value) return "other";
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed.length) return "other";
  if (["approved", "pending", "rejected"].includes(trimmed)) {
    return trimmed;
  }
  return trimmed;
};

const safeQuery = async (text, params = [], fallbackRows = []) => {
  try {
    return await pool.query(text, params);
  } catch (error) {
    console.error("dashboardService query failed", {
      message: error?.message,
      preview: text.trim().slice(0, 140),
    });
    return { rows: fallbackRows };
  }
};

const buildSubmissionHeatmap = (rows = []) => {
  const barangayMap = new Map();
  const statusSet = new Set(["approved", "pending", "rejected"]);
  let maxCellCount = 0;

  for (const row of rows) {
    const barangayId = row?.barangay_id;
    if (barangayId === null || barangayId === undefined) continue;

    const statusKey = normalizeStatusKey(row?.status);
    const count = toNumber(row?.total);
    if (statusKey) statusSet.add(statusKey);

    if (!barangayMap.has(barangayId)) {
      barangayMap.set(barangayId, {
        barangayId,
        barangayName: row?.barangay_name || `Barangay ${barangayId}`,
        total: 0,
        counts: {},
      });
    }

    const entry = barangayMap.get(barangayId);
    entry.counts[statusKey] = (entry.counts[statusKey] || 0) + count;
    entry.total += count;
    if (entry.counts[statusKey] > maxCellCount) {
      maxCellCount = entry.counts[statusKey];
    }
  }

  const barangays = Array.from(barangayMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  return {
    barangays,
    statuses: Array.from(statusSet).filter(Boolean),
    maxCellCount,
  };
};

const buildHarvestComparison = (rows = []) => {
  const seasonMap = new Map();
  let maxSeasonYield = 0;

  for (const row of rows) {
    const seasonKey = normalizeSeasonKey(row?.season_key);
    const statusKey = normalizeStatusKey(row?.status);
    const totalYield = toNumber(row?.total_yield);
    const recordCount = toNumber(row?.record_count);

    if (!seasonMap.has(seasonKey)) {
      seasonMap.set(seasonKey, {
        seasonKey,
        seasonLabel: formatSeasonLabel(seasonKey),
        approved: 0,
        pending: 0,
        rejected: 0,
        other: 0,
        recordCount: 0,
        totalYield: 0,
      });
    }

    const entry = seasonMap.get(seasonKey);
    entry.totalYield += totalYield;
    entry.recordCount += recordCount;

    if (statusKey === "approved") {
      entry.approved += totalYield;
    } else if (statusKey === "pending") {
      entry.pending += totalYield;
    } else if (statusKey === "rejected") {
      entry.rejected += totalYield;
    } else {
      entry.other += totalYield;
    }

    if (entry.totalYield > maxSeasonYield) {
      maxSeasonYield = entry.totalYield;
    }
  }

  const seasons = Array.from(seasonMap.values()).sort((a, b) => b.totalYield - a.totalYield);

  return {
    seasons,
    maxSeasonYield,
  };
};

const buildTopBarangaysPayload = (rows = [], currentSeasonMeta = null) => {
  const barangays = ensureArray(rows)
    .map((row) => ({
      barangayId: row?.barangay_id,
      barangayName: row?.barangay_name || (row?.barangay_id ? `Barangay ${row.barangay_id}` : "Unspecified"),
      totalYield: toNumber(row?.total_yield),
      submissionCount: toNumber(row?.submission_count ?? row?.count),
    }))
    .filter((entry) => entry.barangayId !== null && entry.barangayId !== undefined)
    .sort((a, b) => b.totalYield - a.totalYield)
    .slice(0, 5);

  const totalYield = barangays.reduce((sum, entry) => sum + entry.totalYield, 0);
  const maxYield = barangays.reduce((max, entry) => Math.max(max, entry.totalYield), 0);

  const seasonKey = currentSeasonMeta?.seasonKey || null;

  return {
    season: {
      key: seasonKey,
      label: seasonKey ? formatSeasonLabel(seasonKey) : null,
      year: currentSeasonMeta?.year || null,
    },
    barangays,
    totalYield,
    maxYield,
  };
};

const fetchTopBarangays = async (currentSeasonMeta) => {
  const filters = ["LOWER(by.status::text) = 'approved'"];
  const params = [];

  if (currentSeasonMeta?.seasonKey) {
    params.push(currentSeasonMeta.seasonKey);
    filters.push(`COALESCE(NULLIF(TRIM(LOWER(by.season)), ''), 'unspecified') = $${params.length}`);
  }

  const seasonYear = toNumber(currentSeasonMeta?.year);
  if (Number.isFinite(seasonYear) && seasonYear > 0) {
    params.push(seasonYear);
    filters.push(`COALESCE(by.year, 0) = $${params.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const query = `
    SELECT 
      b.barangay_id,
      b.adm3_en AS barangay_name,
      SUM(COALESCE(by.total_yield, 0)) AS total_yield,
      COUNT(*) AS submission_count
    FROM barangay_yields by
    JOIN barangays b ON b.barangay_id = by.barangay_id
    ${whereClause}
    GROUP BY b.barangay_id, b.adm3_en
    ORDER BY total_yield DESC
    LIMIT 8
  `;

  const result = await safeQuery(query, params, []);

  if (result.rows.length === 0 && params.length > 0) {
    // fallback to all approved records if filters returned nothing
    return safeQuery(
      `
        SELECT 
          b.barangay_id,
          b.adm3_en AS barangay_name,
          SUM(COALESCE(by.total_yield, 0)) AS total_yield,
          COUNT(*) AS submission_count
        FROM barangay_yields by
        JOIN barangays b ON b.barangay_id = by.barangay_id
        WHERE LOWER(by.status::text) = 'approved'
        GROUP BY b.barangay_id, b.adm3_en
        ORDER BY total_yield DESC
        LIMIT 8
      `,
      [],
      []
    );
  }

  return result;
};

const TIMELINE_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

const normalizeTechnicianStatus = (status) => {
  const key = normalizeStatusKey(status);
  if (key === "verified") return "approved";
  if (key === "approved") return "approved";
  if (key === "pending") return "pending";
  if (key === "rejected") return "rejected";
  return "other";
};

const buildTechnicianSummary = async (userId) => {
  const normalizedUserId = Number.parseInt(userId, 10);

  const emptySummary = {
    totals: {
      barangaysReported: 0,
      submissions: 0,
      topCrop: null,
    },
    statusDistribution: [
      { status: "approved", count: 0 },
      { status: "pending", count: 0 },
      { status: "rejected", count: 0 },
    ],
    timeline: [],
    recommendationBreakdown: [],
  };

  if (!Number.isFinite(normalizedUserId)) {
    return emptySummary;
  }

  const statusCaseExpression = `CASE
    WHEN LOWER(status::text) IN ('approved', 'verified') THEN 'approved'
    WHEN LOWER(status::text) = 'pending' THEN 'pending'
    WHEN LOWER(status::text) = 'rejected' THEN 'rejected'
    ELSE 'other'
  END`;

  const [
    barangaysResult,
    statusResult,
    timelineResult,
    latestSeasonResult,
    globalSeasonResult,
  ] = await Promise.all([
    safeQuery(
      `
        SELECT DISTINCT barangay_id
        FROM (
          SELECT barangay_id FROM barangay_yields WHERE recorded_by_user_id = $1
          UNION
          SELECT barangay_id FROM barangay_crop_prices WHERE recorded_by_user_id = $1
        ) AS combined
        WHERE barangay_id IS NOT NULL
      `,
      [normalizedUserId],
      [],
    ),
    safeQuery(
      `
        SELECT status, COUNT(*) AS total
        FROM (
          SELECT ${statusCaseExpression} AS status
          FROM barangay_yields
          WHERE recorded_by_user_id = $1

          UNION ALL

          SELECT ${statusCaseExpression} AS status
          FROM barangay_crop_prices
          WHERE recorded_by_user_id = $1
        ) AS combined
        GROUP BY status
      `,
      [normalizedUserId],
      [],
    ),
    safeQuery(
      `
        SELECT
          year,
          month,
          status,
          COUNT(*) AS total
        FROM (
          SELECT
            COALESCE(year, 0) AS year,
            COALESCE(month, 0) AS month,
            ${statusCaseExpression} AS status
          FROM barangay_yields
          WHERE recorded_by_user_id = $1

          UNION ALL

          SELECT
            COALESCE(year, 0) AS year,
            COALESCE(month, 0) AS month,
            ${statusCaseExpression} AS status
          FROM barangay_crop_prices
          WHERE recorded_by_user_id = $1
        ) AS combined
        WHERE year IS NOT NULL AND year > 0 AND month IS NOT NULL AND month BETWEEN 1 AND 12
        GROUP BY year, month, status
        ORDER BY year ASC, month ASC, status ASC
      `,
      [normalizedUserId],
      [],
    ),
    safeQuery(
      `
        SELECT
          COALESCE(NULLIF(TRIM(LOWER(season)), ''), 'unspecified') AS season_key,
          COALESCE(year, 0) AS year_value,
          COALESCE(month, 0) AS month_value,
          MAX(yield_id) AS max_id
        FROM barangay_yields
        WHERE recorded_by_user_id = $1
        GROUP BY COALESCE(NULLIF(TRIM(LOWER(season)), ''), 'unspecified'), COALESCE(year, 0), COALESCE(month, 0)
        ORDER BY year_value DESC NULLS LAST, month_value DESC NULLS LAST, max_id DESC
        LIMIT 1
      `,
      [normalizedUserId],
      [],
    ),
    safeQuery(
      `
        SELECT
          COALESCE(NULLIF(TRIM(LOWER(season)), ''), 'unspecified') AS season_key,
          COALESCE(year, 0) AS year_value,
          MAX(yield_id) AS max_id
        FROM barangay_yields
        WHERE LOWER(status::text) IN ('approved', 'verified')
        GROUP BY COALESCE(NULLIF(TRIM(LOWER(season)), ''), 'unspecified'), COALESCE(year, 0)
        ORDER BY year_value DESC NULLS LAST, max_id DESC
        LIMIT 1
      `,
      [],
      [],
    ),
  ]);

  const barangayIds = Array.from(
    new Set(
      (barangaysResult.rows || [])
        .map((row) => toNumber(row?.barangay_id))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  );

  const statusCounts = {
    approved: 0,
    pending: 0,
    rejected: 0,
    other: 0,
  };
  for (const row of statusResult.rows || []) {
    const key = normalizeTechnicianStatus(row?.status);
    const count = toNumber(row?.total);
    if (statusCounts[key] !== undefined) {
      statusCounts[key] += count;
    } else {
      statusCounts.other += count;
    }
  }

  const timelineMap = new Map();
  for (const row of timelineResult.rows || []) {
    const yearValue = toNumber(row?.year);
    const monthValue = toNumber(row?.month);
    if (!Number.isFinite(yearValue) || !Number.isFinite(monthValue) || monthValue < 1 || monthValue > 12) {
      continue;
    }

    const key = `${yearValue}-${String(monthValue).padStart(2, "0")}`;
    if (!timelineMap.has(key)) {
      timelineMap.set(key, {
        key,
        year: yearValue,
        month: monthValue,
        approved: 0,
        pending: 0,
        rejected: 0,
        other: 0,
        total: 0,
      });
    }

    const entry = timelineMap.get(key);
    const statusKey = normalizeTechnicianStatus(row?.status);
    const count = toNumber(row?.total);
    if (entry[statusKey] !== undefined) {
      entry[statusKey] += count;
    } else {
      entry.other += count;
    }
    entry.total += count;
  }

  const sortedTimelineEntries = Array.from(timelineMap.values()).sort((a, b) => {
    const first = new Date(Date.UTC(a.year, a.month - 1, 1)).getTime();
    const second = new Date(Date.UTC(b.year, b.month - 1, 1)).getTime();
    return first - second;
  });
  const lastTwelveTimeline = sortedTimelineEntries.slice(-12).map((entry) => {
    const date = new Date(Date.UTC(entry.year, entry.month - 1, 1));
    const label = Number.isNaN(date.getTime()) ? `${entry.year}-${String(entry.month).padStart(2, "0")}` : TIMELINE_LABEL_FORMATTER.format(date);
    return {
      ...entry,
      label,
    };
  });

  const latestSeasonRow = latestSeasonResult.rows?.[0] || null;
  const normalizedSeasonKey = latestSeasonRow?.season_key ? normalizeSeasonKey(latestSeasonRow.season_key) : null;
  const normalizedSeason = normalizedSeasonKey && normalizedSeasonKey !== "unspecified" ? normalizedSeasonKey : null;
  const normalizedYear = toNumber(latestSeasonRow?.year_value);
  const seasonYear = Number.isFinite(normalizedYear) && normalizedYear > 0 ? normalizedYear : null;

  const globalSeasonRow = globalSeasonResult.rows?.[0] || null;
  const rawGlobalSeasonKey = globalSeasonRow?.season_key || null;
  const normalizedGlobalSeasonKey = rawGlobalSeasonKey ? normalizeSeasonKey(rawGlobalSeasonKey) : null;
  const globalSeasonKey = normalizedGlobalSeasonKey && normalizedGlobalSeasonKey !== "unspecified" ? normalizedGlobalSeasonKey : null;
  const globalSeasonYearRaw = toNumber(globalSeasonRow?.year_value);
  const globalSeasonYear = Number.isFinite(globalSeasonYearRaw) && globalSeasonYearRaw > 0 ? globalSeasonYearRaw : null;

  const globalTopCropFilters = ["LOWER(by.status::text) IN ('approved', 'verified')"];
  const globalTopCropParams = [];

  if (globalSeasonYear) {
    globalTopCropParams.push(globalSeasonYear);
    globalTopCropFilters.push(`COALESCE(by.year, 0) = $${globalTopCropParams.length}`);
  }

  if (globalSeasonKey) {
    globalTopCropParams.push(globalSeasonKey);
    globalTopCropFilters.push(`COALESCE(NULLIF(TRIM(LOWER(by.season)), ''), 'unspecified') = $${globalTopCropParams.length}`);
  }

  const globalTopCropWhereClause = globalTopCropFilters.length ? `WHERE ${globalTopCropFilters.join(" AND ")}` : "";

  let globalTopCropResult = await safeQuery(
    `
      SELECT
        c.crop_name,
        SUM(COALESCE(by.total_yield, 0)) AS total_yield,
        COUNT(*) AS entry_count
      FROM barangay_yields by
      JOIN crops c ON c.crop_id = by.crop_id
      ${globalTopCropWhereClause}
      GROUP BY c.crop_name
      ORDER BY total_yield DESC NULLS LAST, entry_count DESC NULLS LAST, c.crop_name ASC
      LIMIT 1
    `,
    globalTopCropParams,
    [],
  );

  let topCropRow = globalTopCropResult.rows?.[0] || null;
  let topCropSeason = globalSeasonKey;
  let topCropYear = globalSeasonYear;

  if (!topCropRow && globalTopCropFilters.length > 1) {
    globalTopCropResult = await safeQuery(
      `
        SELECT
          c.crop_name,
          SUM(COALESCE(by.total_yield, 0)) AS total_yield,
          COUNT(*) AS entry_count
        FROM barangay_yields by
        JOIN crops c ON c.crop_id = by.crop_id
        WHERE LOWER(by.status::text) IN ('approved', 'verified')
        GROUP BY c.crop_name
        ORDER BY total_yield DESC NULLS LAST, entry_count DESC NULLS LAST, c.crop_name ASC
        LIMIT 1
      `,
      [],
      [],
    );
    topCropRow = globalTopCropResult.rows?.[0] || null;
    if (topCropRow) {
      topCropSeason = null;
      topCropYear = null;
    }
  }

  let recommendationRows = [];
  if (barangayIds.length) {
    const recommendationParams = [barangayIds];
    const recommendationConditions = [`r.barangay_id = ANY($1::int[])`];

    if (seasonYear) {
      recommendationParams.push(seasonYear);
      recommendationConditions.push(`COALESCE(r.year, 0) = $${recommendationParams.length}`);
    }

    if (normalizedSeason) {
      recommendationParams.push(normalizedSeason);
      recommendationConditions.push(`COALESCE(NULLIF(TRIM(LOWER(r.season)), ''), 'unspecified') = $${recommendationParams.length}`);
    }

    const recommendationQuery = `
      SELECT c.crop_name, COUNT(*) AS total
      FROM recommendations r
      JOIN crops c ON c.crop_id = r.crop_id
      WHERE ${recommendationConditions.join(" AND ")}
      GROUP BY c.crop_name
      ORDER BY total DESC NULLS LAST, c.crop_name ASC
      LIMIT 10
    `;

    const recommendationResult = await safeQuery(recommendationQuery, recommendationParams, []);
    recommendationRows = recommendationResult.rows || [];
  }

  const totalSubmissions = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);

  const summary = {
    totals: {
      barangaysReported: barangayIds.length,
      submissions: totalSubmissions,
      topCrop: topCropRow
        ? {
            name: topCropRow.crop_name || "Unspecified",
            totalYield: toNumber(topCropRow.total_yield),
            entries: toNumber(topCropRow.entry_count),
            season: topCropSeason,
            seasonLabel: topCropSeason ? formatSeasonLabel(topCropSeason) : null,
            year: topCropYear,
            scope: "global",
          }
        : null,
    },
    statusDistribution: [
      { status: "approved", count: statusCounts.approved },
      { status: "pending", count: statusCounts.pending },
      { status: "rejected", count: statusCounts.rejected },
    ],
    timeline: lastTwelveTimeline,
    recommendationBreakdown: recommendationRows.map((row) => ({
      crop: row?.crop_name || "Unspecified",
      count: toNumber(row?.total),
    })),
  };

  return summary;
};

export const fetchDashboardMetricsService = async (options = {}) => {
  const normalizedUserId = Number.parseInt(options?.userId, 10);
  const normalizedRoleId = Number.parseInt(options?.roleId, 10);
  const baseQuery = `
    SELECT
      COALESCE((SELECT COUNT(*) FROM approvals WHERE status = 'pending'), 0) AS pending_approvals,
      COALESCE((SELECT COUNT(*) FROM approvals WHERE status = 'rejected'), 0) AS rejected_approvals,
      COALESCE((SELECT COUNT(*) FROM users WHERE roleid = $1), 0) AS technician_count,
      COALESCE((SELECT COUNT(*) FROM barangays), 0) AS barangay_count,
      COALESCE((SELECT COUNT(*) FROM crops), 0) AS crop_count,
      COALESCE((SELECT COUNT(*) FROM users), 0) AS total_users,
      0 AS total_recommendations,
      COALESCE((SELECT COUNT(*) FROM barangay_yields), 0) AS yield_total,
      COALESCE((SELECT COUNT(*) FROM barangay_yields WHERE status = 'pending'), 0) AS yield_pending,
      COALESCE((SELECT COUNT(*) FROM barangay_crop_prices), 0) AS price_total,
      COALESCE((SELECT COUNT(*) FROM barangay_crop_prices WHERE status = 'pending'), 0) AS price_pending
  `;

  const [
    baseResult,
    approvedThisMonthResult,
    submissionHeatmapResult,
    harvestComparisonResult,
    currentSeasonResult,
  ] = await Promise.all([
    safeQuery(baseQuery, [ROLES.TECHNICIAN], [{}]),
    safeQuery(
      `SELECT COALESCE(COUNT(*), 0) AS approved_this_month
       FROM approvals
       WHERE status = 'approved'
         AND performed_at >= DATE_TRUNC('month', CURRENT_DATE)`
    ),
    safeQuery(
      `
        SELECT combined.barangay_id,
               combined.barangay_name,
               combined.status,
               SUM(combined.count) AS total
        FROM (
          SELECT 
            by.barangay_id,
            b.adm3_en AS barangay_name,
            LOWER(by.status::text) AS status,
            COUNT(*) AS count
          FROM barangay_yields by
          JOIN barangays b ON b.barangay_id = by.barangay_id
          GROUP BY by.barangay_id, b.adm3_en, LOWER(by.status::text)

          UNION ALL

          SELECT 
            cp.barangay_id,
            b.adm3_en AS barangay_name,
            LOWER(cp.status::text) AS status,
            COUNT(*) AS count
          FROM barangay_crop_prices cp
          JOIN barangays b ON b.barangay_id = cp.barangay_id
          GROUP BY cp.barangay_id, b.adm3_en, LOWER(cp.status::text)
        ) AS combined
        GROUP BY combined.barangay_id, combined.barangay_name, combined.status
      `
    ),
    safeQuery(
      `
        SELECT 
          COALESCE(NULLIF(TRIM(LOWER(season)), ''), 'unspecified') AS season_key,
          LOWER(status::text) AS status,
          SUM(COALESCE(total_yield, 0)) AS total_yield,
          COUNT(*) AS record_count
        FROM barangay_yields
        GROUP BY 1, 2
      `
    ),
    safeQuery(
      `
        SELECT 
          COALESCE(NULLIF(TRIM(LOWER(season)), ''), 'unspecified') AS season_key,
          MAX(COALESCE(year, 0)) AS year_value,
          COUNT(*) AS record_count
        FROM barangay_yields
        WHERE LOWER(status::text) = 'approved'
        GROUP BY 1
        ORDER BY year_value DESC NULLS LAST, record_count DESC
        LIMIT 1
      `
    ),
  ]);

  const baseRow = baseResult?.rows?.[0] || {};
  const currentSeasonRaw = currentSeasonResult?.rows?.[0] || null;
  const currentSeasonMeta = currentSeasonRaw
    ? {
        seasonKey: normalizeSeasonKey(currentSeasonRaw.season_key),
        year: toNumber(currentSeasonRaw.year_value) || null,
      }
    : null;

  const topBarangaysResult = await fetchTopBarangays(currentSeasonMeta);

  const yieldTotal = toNumber(baseRow.yield_total);
  const priceTotal = toNumber(baseRow.price_total);
  const yieldPending = toNumber(baseRow.yield_pending);
  const pricePending = toNumber(baseRow.price_pending);
  const totalUsers = toNumber(baseRow.total_users);
  const pendingSubmissions = yieldPending + pricePending;
  const rejectedSubmissions = toNumber(baseRow.rejected_approvals);
  const approvedThisMonth = toNumber(approvedThisMonthResult?.rows?.[0]?.approved_this_month);
  const submissionHeatmap = buildSubmissionHeatmap(submissionHeatmapResult.rows);
  const barangaysWithSubmissions = submissionHeatmap.barangays.filter((entry) => toNumber(entry.total) > 0).length;
  const totalBarangays = Math.max(toNumber(baseRow.barangay_count), 0);
  const submissionRate = totalBarangays > 0 ? (barangaysWithSubmissions / totalBarangays) * 100 : 0;

  const totals = {
    users: totalUsers,
    dataRecords: yieldTotal + priceTotal,
    recommendations: 0,
  };

  const insights = {
    cards: {
      totalUsers,
      totalEntries: yieldTotal + priceTotal,
      submissionRate,
    },
    submissionHeatmap,
    harvestComparison: buildHarvestComparison(harvestComparisonResult.rows),
    topBarangays: buildTopBarangaysPayload(topBarangaysResult.rows, currentSeasonMeta),
  };

  const technicianSummary =
    Number.isFinite(normalizedUserId) && normalizedRoleId === ROLES.TECHNICIAN
      ? await buildTechnicianSummary(normalizedUserId)
      : null;

  return {
    technicianCount: toNumber(baseRow.technician_count),
    barangayCount: toNumber(baseRow.barangay_count),
    cropCount: toNumber(baseRow.crop_count),
    pendingApprovals: toNumber(baseRow.pending_approvals),
    rejectedSubmissions,
    yieldSummary: {
      total: yieldTotal,
      pending: yieldPending,
    },
    priceSummary: {
      total: priceTotal,
      pending: pricePending,
    },
    totalSubmissions: yieldTotal + priceTotal,
    pendingSubmissions,
    totals,
    insights,
    lastUpdated: new Date().toISOString(),
    technicianSummary,
  };
};

export default {
  fetchDashboardMetricsService,
};
