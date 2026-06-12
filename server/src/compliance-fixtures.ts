/**
 * Demo regulatory-document payloads for the vessel_divorce widget, used when the
 * live DCS/MRV endpoints return nothing usable — on stage that's the
 * `403 RBAC: access denied` case (the demo/trafigura tenants lack the
 * emission-analytics role) or a 404.
 *
 * Same pattern as `emissions-fixtures.ts`: rather than rendering empty papers,
 * fall back to hand-authored, plausibly-shaped demo records so the divorce decree
 * and its downloads render end-to-end. The handler tags the result
 * `dataSource: "fixture"` and the knowledge doc tells the agent to say
 * "demo fixture data" — never to present it as live.
 *
 * Figures are illustrative for a mid-life vessel, not real data. Built per-IMO so
 * any vessel renders a populated set of papers in the offline/demo fallback.
 */

type ComplianceFixture = {
  imoDcs: Record<string, unknown>;
  euMrvVoyage: Record<string, unknown>;
  mrvVessel: Record<string, unknown>;
};

/** A complete demo document set for one IMO, derived from the IMO so the papers
 *  are self-consistent (same IMO echoed across all three) and clearly demo. */
const getComplianceFixture = (imo: number, year: number): ComplianceFixture => ({
  imoDcs: {
    imo,
    reportingYear: year,
    statementOfCompliance: "DEMO — illustrative IMO DCS record",
    distanceTravelledNm: 91500,
    hoursUnderway: 5840,
    fuelOilConsumptionTons: { hfo: 14200, mgo: 1850, lng: 0 },
    co2EmissionsTons: 49850,
  },
  euMrvVoyage: {
    imo,
    reportingYear: year,
    scope: "EU MRV — voyage level (DEMO)",
    voyages: [
      { from: "ROTTERDAM", to: "SINGAPORE", euMrvEligible: true, co2EmissionsTons: 8200, distanceNm: 8300 },
      { from: "SINGAPORE", to: "FUJAIRAH", euMrvEligible: false, co2EmissionsTons: 3100, distanceNm: 3600 },
    ],
  },
  mrvVessel: {
    imo,
    reportingYear: year,
    scope: "EU/UK MRV — vessel level (DEMO)",
    co2EmissionsTons: 49850,
    fuelConsumptionTons: 16050,
    averageEmissionsPerDistance: 5.97,
    verifier: "DEMO Verification Body",
    verificationStatus: "satisfactory",
  },
});

export { getComplianceFixture };
export type { ComplianceFixture };
