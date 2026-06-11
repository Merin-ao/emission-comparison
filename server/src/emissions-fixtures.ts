/**
 * Fixture emissions / compliance figures, used only when the live
 * emission-analytics API has nothing usable for a vessel — which on stage means
 * the `403 RBAC: access denied` case (the demo/trafigura tenants lack the
 * emission-analytics role) or a 404.
 *
 * Same pattern as `fixtures.ts` (noon reports) and the reference emission-analyst
 * submission's offline mode: rather than rendering an empty card, fall back to a
 * hand-authored, schema-shaped demo payload so the widget/answer renders
 * end-to-end. The handler tags these `dataSource: "fixture"` and the knowledge
 * doc tells the agent to say "demo fixture data" — never to present it as live.
 *
 * Figures are plausible mid-range values for a ~80k DWT bulker, not real data.
 */

type EmissionsFigures = {
  euEtsExposure: number;
  ciiRating: string;
  ciiAttained: number;
  ciiRequired: number;
  fuelEuComplianceBalance: number;
  fuelEuPenaltyCost: number;
  dwt: number;
  eligibility: { euMrv: boolean; ukMrv: boolean; fuelEu: boolean; euEts: boolean };
  /** Ship type + annual CO2eq, so the vessel-tinder widgets (type label, pooling
   *  CO2-avoidable) still render in the offline/demo fallback. */
  type: string;
  co2eq: number;
  iceClass: string;
  averageSpeed: number;
  yearOfBuild: number;
  distanceSailed: number;
};

const fixtures: Record<number, EmissionsFigures> = {
  // MV Captain's Pride — pairs with the noon-report fixture for the same IMO.
  // CII "C" (on the band edge), small FuelEU deficit, moderate EU ETS bill.
  9920760: {
    euEtsExposure: 412_000,
    ciiRating: "C",
    ciiAttained: 8.42,
    ciiRequired: 8.9,
    fuelEuComplianceBalance: -1_250,
    fuelEuPenaltyCost: 38_400,
    dwt: 81_000,
    eligibility: { euMrv: true, ukMrv: true, fuelEu: true, euEts: true },
    type: "Bulk carrier",
    co2eq: 42_800,
    iceClass: "1A",
    averageSpeed: 12.4,
    yearOfBuild: 2014,
    distanceSailed: 72_000,
  },
  // Demo (1234567) — strong performer: CII "B", FuelEU surplus, no penalty.
  1234567: {
    euEtsExposure: 286_500,
    ciiRating: "B",
    ciiAttained: 6.91,
    ciiRequired: 7.8,
    fuelEuComplianceBalance: 540,
    fuelEuPenaltyCost: 0,
    dwt: 63_000,
    eligibility: { euMrv: true, ukMrv: false, fuelEu: true, euEts: true },
    type: "Bulk carrier",
    co2eq: 31_200,
    iceClass: "1C",
    averageSpeed: 13.1,
    yearOfBuild: 2021,
    distanceSailed: 84_200,
  },
  // Demo 1 (1234568) — laggard: CII "E", large deficit + penalty (risk demo).
  1234568: {
    euEtsExposure: 597_200,
    ciiRating: "E",
    ciiAttained: 11.74,
    ciiRequired: 9.1,
    fuelEuComplianceBalance: -4_300,
    fuelEuPenaltyCost: 132_800,
    dwt: 115_000,
    eligibility: { euMrv: true, ukMrv: true, fuelEu: true, euEts: true },
    type: "Crude oil tanker",
    co2eq: 61_500,
    iceClass: "None",
    averageSpeed: 11.6,
    yearOfBuild: 2008,
    distanceSailed: 91_500,
  },
};

const getEmissionsFixture = (imo: number): EmissionsFigures | null => fixtures[imo] ?? null;

const emissionsFixtureImos = (): number[] => Object.keys(fixtures).map(Number);

export { getEmissionsFixture, emissionsFixtureImos };
export type { EmissionsFigures };
