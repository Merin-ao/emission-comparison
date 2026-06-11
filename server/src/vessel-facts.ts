/**
 * Shared per-vessel fact-gathering for every emissions widget tool.
 *
 * One vessel → one normalized `VesselFacts`, assembled from up to three
 * emission-analytics-api calls (vessel-details, year-to-date-cii, fuel-eu).
 * Every widget projection (biodata, roast, traffic-signal, love-meter, match,
 * breakup, pooling, and the emission_analytics card) derives purely from this —
 * so the upstream wiring lives in ONE place and the widgets never invent data.
 *
 * Graceful degradation matches the emissions handler: 403/404/fetch-failure on
 * any upstream is softened to null; if nothing usable comes back we fall back to
 * the demo fixture (`dataSource: "fixture"`), else report unavailable. Never
 * throws for the expected upstream conditions.
 */

import {
  EmissionsError,
  getFuelEuDetails,
  getYearToDateCii,
  getVesselDetails,
  getVesselCharacteristics,
  type CiiRef,
} from "./emission-analytics.ts";
import { getEmissionsFixture } from "./emissions-fixtures.ts";

type Eligibility = {
  euMrv: boolean | null;
  ukMrv: boolean | null;
  fuelEu: boolean | null;
  euEts: boolean | null;
};

/** Normalized real facts for one vessel. All figures nullable — a field is null
 *  when no upstream source supplied it (we never fabricate). */
type VesselFacts = {
  imo: number;
  year: number;
  vesselName: string | null;
  /** Ship type for CII purposes, e.g. "Bulk carrier". */
  type: string | null;
  dwt: number | null;
  /** Year the vessel was built (from /vessel-characteristics). */
  builtYear: number | null;
  /** Attained CII rating A–E (A best) and its numeric value. */
  ciiRating: string | null;
  ciiAttained: number | null;
  ciiRequired: number | null;
  /** Prior-year attained CII, for "last year's grade" comparisons. */
  prevCiiRating: string | null;
  prevCiiAttained: number | null;
  /** Year-on-year CII direction. */
  ciiTrend: "up" | "down" | "flat" | null;
  /** EU ETS carbon cost (EUA cost) in EUR. */
  etsCost: number | null;
  /** Total CO2eq emissions (tonnes). */
  co2eq: number | null;
  distanceSailed: number | null;
  /** Average speed over the period, in knots. */
  averageSpeed: number | null;
  /** Ice class notation, e.g. "1A". */
  iceClass: string | null;
  /** Dominant fuel grade by consumption, e.g. "VLSFO". */
  mainFuel: string | null;
  /** FuelEU compliance balance in tCO2eq (positive = surplus). */
  fuelEuBalance: number | null;
  /** FuelEU penalty cost in EUR. */
  fuelEuPenalty: number | null;
  eligibility: Eligibility;
  dataAvailable: boolean;
  dataSource: "live" | "fixture";
  message: string | null;
};

type SeenStatus = { status: number | "fetch_failed" | null };

/** Run an upstream call, returning its value or null on the "expected" upstream
 *  conditions (403 access denied, 404 not found, fetch failure, or any 5xx).
 *  Records the first such status so callers can explain it. Re-throws anything
 *  else. Shared by every fact-gathering call and the emissions handler. */
const soft = async <T>(fn: () => Promise<T>, seen: SeenStatus): Promise<T | null> => {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof EmissionsError) {
      if (seen.status === null) seen.status = err.status;
      const s = err.status;
      if (s === 403 || s === 404 || s === "fetch_failed" || (typeof s === "number" && s >= 500)) {
        return null;
      }
    }
    throw err;
  }
};

const pickMainFuel = (
  fuelWise: { fuelType?: string | null; fuelConsumption?: number | null }[] | null | undefined,
): string | null => {
  if (!fuelWise || fuelWise.length === 0) return null;
  const top = [...fuelWise]
    .filter((f) => f.fuelType)
    .sort((a, b) => (b.fuelConsumption ?? 0) - (a.fuelConsumption ?? 0))[0];
  return top?.fuelType ?? null;
};

/** Round a CII value to 2 dp (upstream returns long floats like 12.5583766…). */
const round2 = (n: number | null | undefined): number | null =>
  n == null ? null : Math.round(n * 100) / 100;
/** Normalize a rating to upper-case (upstream sometimes returns "d"). */
const upperRating = (s: string | null | undefined): string | null => (s ? s.toUpperCase() : null);

const refCii = (r: CiiRef | null | undefined): number | null => round2(r?.cii);
const refRating = (r: CiiRef | null | undefined): string | null => upperRating(r?.rating);

/** Gather one vessel's real facts. Always resolves (never throws on the expected
 *  upstream conditions). `seenOut`, if supplied, receives the first upstream
 *  status observed so a caller batching many vessels can explain a 403 once. */
const gatherVesselFacts = async (
  imo: number,
  year: number,
  auth: string | undefined,
  vesselName: string | null = null,
): Promise<VesselFacts> => {
  const seen: SeenStatus = { status: null };

  const [details, cii, fuelEu, chars] = await Promise.all([
    soft(() => getVesselDetails(imo, year, auth), seen),
    soft(() => getYearToDateCii(imo, auth), seen),
    soft(() => getFuelEuDetails(imo, year, auth), seen),
    soft(() => getVesselCharacteristics([imo], year, auth), seen),
  ]);
  // /vessel-characteristics is the source of build year, and a secondary source
  // for DWT / ice class / subtype / name when /vessel-details is missing them.
  const char = Array.isArray(chars) ? (chars.find((c) => c.imo === imo) ?? chars[0] ?? null) : null;

  // Visibility into which upstreams returned live data (set DEBUG_FACTS=1).
  // Distinguishes "real data" from the fixture fallback at the per-endpoint level
  // — in particular whether /vessel-details (type/DWT/ETS/CO2eq) is accessible.
  if (process.env.DEBUG_FACTS === "1") {
    console.error(
      `[facts] imo=${imo} vessel-details=${details ? "LIVE" : "—"} ytd-cii=${cii ? "LIVE" : "—"} fuel-eu=${fuelEu ? "LIVE" : "—"} characteristics=${char ? "LIVE" : "—"} distanceSailed=${details?.performance?.distanceSailed ?? "—"} builtYear=${char?.yearOfBuild ?? "—"} firstUpstreamStatus=${seen.status}`,
    );
    // Raw values for the fields that came back null/0 despite LIVE endpoints —
    // to confirm whether the upstream nests them differently or they're empty.
    console.error(
      `[facts-raw] imo=${imo} euEtsExposure=${JSON.stringify(details?.vesselEuEtsExposure)} fuelEu.complianceBalance=${JSON.stringify(fuelEu?.complianceBalance)} fuelEu.penaltyCost=${JSON.stringify(fuelEu?.penaltyCost)} fuelConsumption.totalCo2=${details?.fuelConsumption?.totalCo2Emission ?? "—"} performance=${JSON.stringify(details?.performance)}`,
    );
  }

  const aerCii = details?.aer?.cii;
  const comparison = details?.aer?.comparison;
  const trend: VesselFacts["ciiTrend"] =
    comparison?.up === true ? "up" : comparison?.down === true ? "down" : comparison ? "flat" : null;

  const facts: VesselFacts = {
    imo,
    year,
    vesselName: vesselName ?? char?.vesselName ?? null,
    type: details?.shipCiiType ?? char?.vesselTypeAndTrading?.vesselSubtype ?? null,
    dwt: details?.dwt ?? char?.capacity?.deadweight ?? null,
    builtYear: char?.yearOfBuild ?? null,
    ciiRating: upperRating(cii?.rating) ?? refRating(aerCii?.attained),
    ciiAttained: round2(cii?.cii) ?? refCii(aerCii?.attained),
    ciiRequired: refCii(cii?.requiredCii) ?? refCii(aerCii?.required),
    prevCiiRating: refRating(cii?.previousYearCiiAndRating?.attained),
    prevCiiAttained: refCii(cii?.previousYearCiiAndRating?.attained),
    ciiTrend: trend,
    etsCost: details?.vesselEuEtsExposure?.totalEuaCost ?? null,
    co2eq: details?.vesselEuEtsExposure?.totalCo2Emission ?? details?.fuelConsumption?.totalCo2Emission ?? null,
    distanceSailed: details?.performance?.distanceSailed ?? null,
    averageSpeed: typeof details?.performance?.averageSpeed === "number" ? details.performance.averageSpeed : null,
    iceClass: details?.iceClass ?? char?.registration?.iceClass ?? null,
    mainFuel: pickMainFuel(details?.fuelConsumption?.fuelWiseConsumption),
    fuelEuBalance: fuelEu?.complianceBalance?.balanceValue ?? null,
    fuelEuPenalty: fuelEu?.penaltyCost?.penaltyValue ?? null,
    eligibility: {
      euMrv: details?.euMrvEligible ?? null,
      ukMrv: details?.ukMrvEligible ?? null,
      fuelEu: details?.fuelEuEligible ?? null,
      euEts: details?.euEtsGtEligible ?? null,
    },
    dataAvailable: false,
    dataSource: "live",
    message: null,
  };

  // Live data counts as usable if any headline figure came back.
  facts.dataAvailable = [facts.ciiRating, facts.dwt, facts.etsCost, facts.fuelEuBalance].some(
    (v) => v !== null && v !== undefined,
  );
  if (facts.dataAvailable) return facts;

  // Nothing usable live (403 RBAC / 404 / empty / 5xx). Fall back to the demo
  // fixture so the widget renders end-to-end — same pattern as the emissions tool.
  const fixture = getEmissionsFixture(imo);
  if (fixture !== null) {
    const reason =
      seen.status === 403
        ? "the live emission-analytics API is access-denied for this tenant (no emission-analytics role on stage)"
        : `the live emission-analytics API has no data on file for IMO ${imo} in ${year}`;
    return {
      ...facts,
      type: fixture.type,
      iceClass: fixture.iceClass,
      averageSpeed: fixture.averageSpeed,
      builtYear: fixture.yearOfBuild,
      distanceSailed: fixture.distanceSailed,
      dwt: fixture.dwt,
      ciiRating: fixture.ciiRating,
      ciiAttained: fixture.ciiAttained,
      ciiRequired: fixture.ciiRequired,
      etsCost: fixture.euEtsExposure,
      co2eq: fixture.co2eq,
      fuelEuBalance: fixture.fuelEuComplianceBalance,
      fuelEuPenalty: fixture.fuelEuPenaltyCost,
      eligibility: fixture.eligibility,
      dataAvailable: true,
      dataSource: "fixture",
      message: `Demo fixture emissions — ${reason}. Present these as demo/illustrative figures, not live data.`,
    };
  }

  // No live data and no fixture — report honestly.
  if (seen.status === 403) {
    facts.message =
      `Access denied (403 RBAC) to emission-analytics for IMO ${imo}. The current operator/tenant ` +
      "lacks the emission-analytics role on stage. Tell the user the figures are unavailable; do not estimate them.";
  } else if (seen.status === 404 || seen.status === null) {
    facts.message = `No emissions / CII / FuelEU data on file for IMO ${imo} in ${year}.`;
  } else {
    facts.message = `emission-analytics returned ${seen.status} for IMO ${imo}; figures unavailable.`;
  }
  return facts;
};

export { gatherVesselFacts, soft };
export type { VesselFacts, Eligibility };
