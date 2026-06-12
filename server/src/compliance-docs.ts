/**
 * Typed client for the regulatory-DOCUMENT endpoints of emission-analytics-api
 * (stage) — the IMO DCS and EU/UK MRV report sources behind the vessel_divorce
 * "divorce papers".
 *
 * These live on the SAME host as the rest of emission-analytics, so we reuse its
 * `request` helper (same token forwarding, timeout and error semantics) rather
 * than standing up a second client. Like the rest of the API they are RBAC-gated
 * on stage; the divorce handler softens 403/404/fetch-failure to the demo
 * fixture (see compliance-fixtures.ts), same as every other vessel-tinder tool.
 *
 * We only need each response VERBATIM (the widget carries it as `doc.raw` and
 * builds the downloadable file client-side), so the shapes are intentionally
 * loose `Record<string, unknown>` — we never project individual fields here.
 */

import { request } from "./emission-analytics.ts";

/** Raw IMO Data Collection System record for one vessel/year. */
type ImoDcsData = Record<string, unknown>;
/** Raw EU MRV voyage-level report for one vessel/year. */
type EuMrvVoyageData = Record<string, unknown>;
/** Raw EU/UK MRV vessel-level report for one vessel/year. */
type MrvVesselReportData = Record<string, unknown>;

/** IMO DCS data — `/imo-dcs/{imo}`. */
const getImoDcs = (imo: number, year: number, auth: string | undefined) =>
  request<ImoDcsData>(`/imo-dcs/${imo}`, { year }, auth);

/** EU MRV voyage-level data — `/eu-mrv-voyage-level/{imo}`. */
const getEuMrvVoyage = (imo: number, year: number, auth: string | undefined) =>
  request<EuMrvVoyageData>(`/eu-mrv-voyage-level/${imo}`, { year }, auth);

/** EU/UK MRV vessel-level report — `/mrv-vessel-level-report/{imo}`. Also the
 *  source the THETIS-MRV verified copy is generated from. */
const getMrvVesselReport = (imo: number, year: number, auth: string | undefined) =>
  request<MrvVesselReportData>(`/mrv-vessel-level-report/${imo}`, { year }, auth);

export { getImoDcs, getEuMrvVoyage, getMrvVesselReport };
export type { ImoDcsData, EuMrvVoyageData, MrvVesselReportData };
