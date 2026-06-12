/**
 * Fixture noon reports used only when the live data-lake has no record.
 *
 * Why: the stage `demo` tenant has zero noon reports across its vessels
 * (see FEEDBACK.md). To keep the demo compelling, we fall back to these
 * hand-authored fixtures for a handful of IMOs. Production / real-customer
 * tenants with noon reports won't hit this path — the data-lake call
 * succeeds and the fixture is never consulted.
 *
 * Every fixture is grounded in the *real* AIS position of its IMO where one
 * is available (so weather at that position is real, even when the noon
 * report is synthesized). Hand-authored fields: bunker ROBs, fuel
 * consumption, observed weather, voyage_nr, and ports.
 */

import type { NoonReportSummary } from "./handlers/get-vessel-noon-report.ts";

const fixtures: Record<number, NoonReportSummary> = {
  // MV Captain's Pride — real AIS trail places her in the Arabian Sea
  // (16.13°N, 66.40°E) on a north-easterly course at ~12 kn. Embellished with
  // a plausible Fujairah → Singapore leg, healthy bunkers, moderate SSW swell.
  9920760: {
    imo: 9920760,
    voyageNr: "42",
    reportType: "noon_at_sea",
    // Reporting daily — recent. In the `vessel_ghosted` demo this is the green
    // "still interested" row. (Demo dates are absolute, pinned near 2026-06-12;
    // they age into staler tiers over time — re-baseline for a fresh demo.)
    datetimeGmt: "2026-06-11T12:00:00Z",
    position: {
      latitude: 16.13,
      longitude: 66.4,
      courseOverGround: 92,
      speedOverGround: 12.4,
      distanceRun24h: 298,
    },
    weatherObserved: {
      windSpeedKn: 18,
      windDirectionDeg: 210,
      waveHeightM: 2.6,
      swellHeightM: 1.9,
      beaufort: 5,
    },
    bunkers: [
      { fuelGrade: "VLSFO", robTonnes: 612 },
      { fuelGrade: "MGO", robTonnes: 84 },
    ],
    consumption24h: [
      { fuelGrade: "VLSFO", consumedTonnes: 28.4 },
      { fuelGrade: "MGO", consumedTonnes: 1.2 },
    ],
    originPort: { unlocode: "AEFJR", name: "Fujairah", latitude: 25.12, longitude: 56.34 },
    destinationPort: { unlocode: "SGSIN", name: "Singapore", latitude: 1.27, longitude: 103.81 },
  },
  // Demo (1234567) — at-anchor variation, lower fuel state, tighter port window.
  1234567: {
    imo: 1234567,
    voyageNr: "117",
    reportType: "at_anchor",
    // Cooling off — a few days quiet. The amber "it's been N days" row.
    datetimeGmt: "2026-06-06T12:00:00Z",
    position: {
      latitude: 1.21,
      longitude: 103.85,
      courseOverGround: null,
      speedOverGround: 0.2,
      distanceRun24h: 4,
    },
    weatherObserved: {
      windSpeedKn: 9,
      windDirectionDeg: 120,
      waveHeightM: 0.6,
      swellHeightM: 0.4,
      beaufort: 3,
    },
    bunkers: [
      { fuelGrade: "VLSFO", robTonnes: 184 },
      { fuelGrade: "MGO", robTonnes: 32 },
    ],
    consumption24h: [
      { fuelGrade: "VLSFO", consumedTonnes: 2.1 },
      { fuelGrade: "MGO", consumedTonnes: 0.8 },
    ],
    originPort: { unlocode: "SGSIN", name: "Singapore", latitude: 1.27, longitude: 103.81 },
    destinationPort: { unlocode: "CNSHA", name: "Shanghai", latitude: 31.23, longitude: 121.47 },
  },
  // Demo 1 (1234568) — long passage, lower fuel margin, "low bunker reserve" risk flag.
  1234568: {
    imo: 1234568,
    voyageNr: "303",
    reportType: "noon_at_sea",
    // Gone dark for ~2 weeks — the red "officially ghosted" row, the dramatic one.
    datetimeGmt: "2026-05-30T12:00:00Z",
    position: {
      latitude: -34.36,
      longitude: 18.47,
      courseOverGround: 304,
      speedOverGround: 11.1,
      distanceRun24h: 261,
    },
    weatherObserved: {
      windSpeedKn: 32,
      windDirectionDeg: 250,
      waveHeightM: 4.8,
      swellHeightM: 3.6,
      beaufort: 7,
    },
    bunkers: [
      { fuelGrade: "VLSFO", robTonnes: 142 },
      { fuelGrade: "MGO", robTonnes: 18 },
    ],
    consumption24h: [
      { fuelGrade: "VLSFO", consumedTonnes: 31.7 },
      { fuelGrade: "MGO", consumedTonnes: 1.5 },
    ],
    originPort: { unlocode: "BRRIG", name: "Rio Grande", latitude: -32.04, longitude: -52.1 },
    destinationPort: { unlocode: "NLRTM", name: "Rotterdam", latitude: 51.92, longitude: 4.48 },
  },
};

const getNoonReportFixture = (imo: number): NoonReportSummary | null => fixtures[imo] ?? null;

const fixtureImos = (): number[] => Object.keys(fixtures).map(Number);

export { getNoonReportFixture, fixtureImos };
