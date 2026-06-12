/**
 * Handlers for the vessel-tinder widget tools. Each gathers real
 * `VesselFacts` for one or more vessels (shared `gatherVesselFacts`) and projects
 * into the widget's input shape. The agent passes each result STRAIGHT to the
 * matching `show_vessel_*` render tool. Always resolves — fact-gathering softens
 * the expected upstream failures and falls back to the demo fixture.
 */

import { getImoDcs, getEuMrvVoyage, getMrvVesselReport } from "../compliance-docs.ts";
import { getComplianceFixture } from "../compliance-fixtures.ts";
import { DataLakeError, getLatestNoonReport } from "../data-lake.ts";
import { getLatestAisPositions, type AisPosition } from "../fleet-map.ts";
import { getVoyageOverview, type VoyageOverviewRow } from "../emission-analytics.ts";
import { emissionsFixtureImos } from "../emissions-fixtures.ts";
import { getNoonReportFixture } from "../fixtures.ts";
import { gatherVesselFacts, softDoc, type VesselFacts } from "../vessel-facts.ts";
import {
  projectBiodata,
  projectFlipCard,
  projectRoast,
  projectLoveMeter,
  projectPooling,
  projectBreakup,
  projectDivorce,
  projectWelcome,
  projectTrafficSignal,
  projectTinderVoyage,
  projectDowry,
  projectGhosted,
  projectCrossing,
  projectNearby,
  projectAwards,
  type DivorceDocSources,
  type GhostRow,
  type VesselGhostedData,
  type NearbyRow,
} from "../vessel-projections.ts";

/** A vessel reference from the agent: IMO plus an optional display name. */
type VesselRef = { imo: number; name: string | null };

const factsFor = (ref: VesselRef, year: number, auth: string | undefined): Promise<VesselFacts> =>
  gatherVesselFacts(ref.imo, year, auth, ref.name);

const factsForMany = (refs: VesselRef[], year: number, auth: string | undefined): Promise<VesselFacts[]> =>
  Promise.all(refs.map((r) => factsFor(r, year, auth)));

const handleGetVesselBiodata = async (ref: VesselRef, year: number, auth: string | undefined) =>
  projectBiodata(await factsFor(ref, year, auth));

// The flip card renders the biodata payload but additionally carries the verbatim
// /year-to-date-cii response (`ytdCiiRaw`) for its raw-data Excel download — so it
// uses its own projection rather than aliasing biodata.
const handleGetVesselFlipCard = async (ref: VesselRef, year: number, auth: string | undefined) =>
  projectFlipCard(await factsFor(ref, year, auth));

const handleGetVesselRoast = async (refs: VesselRef[], year: number, auth: string | undefined) =>
  projectRoast(await factsForMany(refs, year, auth));

const handleGetVesselLoveMeter = async (
  a: VesselRef,
  b: VesselRef,
  year: number,
  auth: string | undefined,
) => {
  const [fa, fb] = await Promise.all([factsFor(a, year, auth), factsFor(b, year, auth)]);
  return projectLoveMeter(fa, fb);
};

const handleGetVesselPooling = async (refs: VesselRef[], year: number, auth: string | undefined) =>
  projectPooling(await factsForMany(refs, year, auth));

// Clean default rebounds, used when the agent didn't supply a reboundImo. These
// are fixture-backed grade-A/B vessels, so the closure always has a real rebound
// with biodata — and the "Meet" button always has a flip card to reveal, rather
// than a dead generic placeholder.
const DEFAULT_REBOUNDS: VesselRef[] = [
  { imo: 9710022, name: "Methane Sapphire" }, // CII A, LNG carrier
  { imo: 1234567, name: "Nordic Aurora" }, // CII B, bulk carrier
];

const handleGetVesselBreakup = async (
  ex: VesselRef,
  keeper: VesselRef | null,
  rebound: VesselRef | null,
  year: number,
  auth: string | undefined,
) => {
  // Fall back to a clean default rebound (distinct from the ex) so "Meet" always
  // reveals a populated card even when no reboundImo was passed.
  const effectiveRebound = rebound ?? DEFAULT_REBOUNDS.find((r) => r.imo !== ex.imo) ?? null;
  const [exF, keeperF, reboundF] = await Promise.all([
    factsFor(ex, year, auth),
    keeper ? factsFor(keeper, year, auth) : Promise.resolve(null),
    effectiveRebound ? factsFor(effectiveRebound, year, auth) : Promise.resolve(null),
  ]);
  return projectBreakup(exF, keeperF, reboundF);
};

// "The Divorce" — the regulatory-document hub. Gathers the focal vessel's facts
// (for the grounds + settlement) and fetches its three DCS/MRV report payloads,
// softening the expected 403/404/failure to the demo fixture set so the decree
// and its downloads always render. Single-vessel-centric: the counterparty is
// fetched only when the user framed it as a divorce from a specific keeper.
const handleGetVesselDivorce = async (
  vessel: VesselRef,
  counterparty: VesselRef | null,
  year: number,
  auth: string | undefined,
) => {
  const [vesselFacts, counterpartyFacts] = await Promise.all([
    factsFor(vessel, year, auth),
    counterparty ? factsFor(counterparty, year, auth) : Promise.resolve(null),
  ]);

  // softDoc (not soft): these document endpoints reject the bare `{ year }` query
  // with a parameter-validation 4xx (400/422) before RBAC applies, on top of the
  // usual 403/404/fetch-failure. softDoc softens all of them to null so we fall
  // back to the demo compliance fixture below rather than surfacing a 502.
  const seen: { status: number | "fetch_failed" | null } = { status: null };
  const [imoDcs, euMrvVoyage, mrvVessel] = await Promise.all([
    softDoc(() => getImoDcs(vessel.imo, year, auth), seen),
    softDoc(() => getEuMrvVoyage(vessel.imo, year, auth), seen),
    softDoc(() => getMrvVesselReport(vessel.imo, year, auth), seen),
  ]);

  // If any document endpoint returned live data, use the live set (missing papers
  // render as "no data on file"). If all were denied/empty, fall back to the demo
  // document set so the papers are still downloadable.
  const anyLive = imoDcs !== null || euMrvVoyage !== null || mrvVessel !== null;
  const sources: DivorceDocSources = anyLive
    ? { imoDcs, euMrvVoyage, mrvVessel, dataSource: "live" }
    : { ...getComplianceFixture(vessel.imo, year), dataSource: "fixture" };

  return projectDivorce(vesselFacts, counterpartyFacts, sources);
};

// ZN Tinder welcome / greeting card. Aggregates real facts across the fleet the
// agent passes (after vessel_get_fleet_vessels). When no IMOs are supplied — e.g.
// a bare "hi" before any fleet lookup — fall back to the demo fixture vessels so
// the greeting still renders a populated (clearly-demo) card rather than nothing.
const handleGetVesselWelcome = async (
  refs: VesselRef[],
  year: number,
  auth: string | undefined,
  operatorName: string | null,
) => {
  const effectiveRefs =
    refs.length > 0 ? refs : emissionsFixtureImos().map((imo) => ({ imo, name: null }) as VesselRef);
  return projectWelcome(await factsForMany(effectiveRefs, year, auth), operatorName);
};

// "Swipe the card" deck: rank fleet vessels as traffic-signal match candidates
// against a reference vessel, scoring purely from real CII / EU ETS / FuelEU /
// trend. Falls back to demo fixture vessels when no candidate IMOs are supplied.
const handleGetVesselTrafficSignal = async (
  anchorName: string,
  refs: VesselRef[],
  year: number,
  auth: string | undefined,
) => {
  const effectiveRefs =
    refs.length > 0 ? refs : emissionsFixtureImos().map((imo) => ({ imo, name: null }) as VesselRef);
  return projectTrafficSignal(anchorName, await factsForMany(effectiveRefs, year, auth));
};

// Demo voyage deck for when /voyage-overview is unavailable (RBAC-denied on stage)
// or returns too few vessels. Mirrors the fixture emissions vessels so the deck
// renders end-to-end; the agent should flag it as demo data.
const VOYAGE_FIXTURE = {
  base: { name: "Methane Sapphire", from: "Rotterdam", to: "Singapore", cii: "A" as const },
  voyageDistanceNm: 8300,
  candidates: [
    { name: "Captain's Pride", type: "Bulk carrier", from: "Rotterdam", to: "Singapore", cii: "C" as const, euPortActivity: 67 },
    { name: "Nordic Aurora", type: "Bulk carrier", from: "Antwerp", to: "Singapore", cii: "B" as const, euPortActivity: 80 },
    { name: "Black Falcon", type: "Crude oil tanker", from: "Hamburg", to: "Fujairah", cii: "E" as const, euPortActivity: 33 },
  ],
};

// "Voyage match" swipe deck, built from the real /voyage-overview dashboard:
// route ports, CII, and EU-port activity (share of EU-MRV-eligible legs) per
// vessel. Falls back to the demo deck when the live API is unavailable or returns
// fewer than two vessels.
const handleGetVesselTinderVoyage = async (anchorImo: number | null, year: number, auth: string | undefined) => {
  let rows: VoyageOverviewRow[];
  try {
    const overview = await getVoyageOverview(year, auth);
    rows = overview.data ?? [];
  } catch {
    rows = [];
  }
  return projectTinderVoyage(rows, anchorImo) ?? VOYAGE_FIXTURE;
};

// Real FuelEU compliance balances for the dowry widget. Returns numbers only —
// the agent writes the funny matrimonial copy and composes the vessel_fueleu_dowry
// payload itself (see zap/knowledge/emissions.md).
const handleGetVesselDowry = async (refs: VesselRef[], year: number, auth: string | undefined) =>
  projectDowry(await factsForMany(refs, year, auth));

// "You've been ghosted": how long since each vessel last sent a noon report.
// Sourced from the data-lake noon report (`datetimeGmt`) — the one upstream the
// operator token reliably reaches (200/404, never 403). `daysSilent` is computed
// here against the wall clock; the projection only picks the tier copy.
const MS_PER_DAY = 86_400_000;

const daysSince = (iso: string | null | undefined, now: number): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / MS_PER_DAY));
};

// One vessel's silence span. Like the other widget tools, this always resolves so
// the card renders end-to-end (including offline / RBAC-denied on stage). On any
// data-lake failure we fall back to the demo fixture; with no fixture, a genuine
// 404 is a REAL "no report on file" gap (live), while a 403/5xx/timeout isn't
// confirmed silence — render it as a demo data-gap row, marked fixture. Only a
// truly unexpected (non-DataLakeError) throw propagates.
const ghostRowFor = async (ref: VesselRef, auth: string | undefined, now: number): Promise<GhostRow> => {
  const name = ref.name ?? `IMO ${ref.imo}`;
  try {
    const report = await getLatestNoonReport(ref.imo, auth);
    return { name, daysSilent: daysSince(report.datetime_gmt, now), dataSource: "live" };
  } catch (err) {
    if (err instanceof DataLakeError) {
      const fixture = getNoonReportFixture(ref.imo);
      if (fixture !== null) return { name, daysSilent: daysSince(fixture.datetimeGmt, now), dataSource: "fixture" };
      return { name, daysSilent: null, dataSource: err.status === 404 ? "live" : "fixture" };
    }
    throw err;
  }
};

const handleGetVesselGhosted = async (
  refs: VesselRef[],
  auth: string | undefined,
): Promise<VesselGhostedData> => {
  const now = Date.now();
  const rows = await Promise.all(refs.map((r) => ghostRowFor(r, auth, now)));
  return projectGhosted(rows);
};

// "Crossing" side-by-side compare: gather each vessel's real facts and project to
// the compare card. The FIRST ref is the reference the others are scored against,
// so the caller must pass the reference IMO first.
const handleGetVesselCrossing = async (refs: VesselRef[], year: number, auth: string | undefined) =>
  projectCrossing(await factsForMany(refs, year, auth));

// "Awards" / hall of fame: returns compact real figures per vessel. The agent
// ranks them, invents the award titles + citations, and composes the
// vessel_awards payload itself (see zap/knowledge/emissions.md).
const handleGetVesselAwards = async (refs: VesselRef[], year: number, auth: string | undefined) =>
  projectAwards(await factsForMany(refs, year, auth));

// "Nearby" radar: for each vessel gather facts (CII/type) + its latest position.
// Position source, in order of preference: live fleet-map AIS (passed in,
// batched once per fleet) → live data-lake noon report → demo noon-report
// fixture. Vessels with no position anywhere are dropped (can't be plotted).
// The reference vessel is the scope centre.
const nearbyRowFor = async (
  ref: VesselRef,
  year: number,
  auth: string | undefined,
  aisPos: AisPosition | undefined,
): Promise<NearbyRow | null> => {
  // Only fetch the noon report as a backstop — when AIS already gave us a fix,
  // skip the call entirely.
  const [facts, report] = await Promise.all([
    factsFor(ref, year, auth),
    aisPos ? Promise.resolve(null) : getLatestNoonReport(ref.imo, auth).catch(() => null),
  ]);
  let lat: number | null | undefined = aisPos?.lat ?? report?.navigational_data?.latitude;
  let lon: number | null | undefined = aisPos?.lon ?? report?.navigational_data?.longitude;
  // Final offline fallback: the demo noon-report fixture (offline / RBAC-denied /
  // no report on file), so the radar still plots end-to-end. NB: the fixture is
  // the projected NoonReportSummary shape (`position`), not the raw data-lake
  // shape (`navigational_data`).
  if (typeof lat !== "number" || typeof lon !== "number") {
    const fixture = getNoonReportFixture(ref.imo);
    lat = fixture?.position?.latitude ?? undefined;
    lon = fixture?.position?.longitude ?? undefined;
  }
  if (typeof lat !== "number" || typeof lon !== "number") {
    return null; // no position anywhere → can't plot
  }
  return { name: facts.vesselName ?? ref.name ?? `IMO ${ref.imo}`, lat, lon, cii: facts.ciiRating, type: facts.type };
};

const handleGetVesselNearby = async (
  referenceName: string,
  refs: VesselRef[],
  year: number,
  auth: string | undefined,
) => {
  // One batched fleet-map AIS call for the whole fleet (the endpoint takes all
  // imos at once); soften any failure to an empty map so per-vessel fallbacks
  // (noon report / fixture) still run.
  const positions = await getLatestAisPositions(
    refs.map((r) => r.imo),
    auth,
  ).catch(() => new Map<number, AisPosition>());
  const rows = (
    await Promise.all(refs.map((r) => nearbyRowFor(r, year, auth, positions.get(r.imo))))
  ).filter((r): r is NearbyRow => r !== null);
  return projectNearby(referenceName, rows);
};

export {
  handleGetVesselBiodata,
  handleGetVesselFlipCard,
  handleGetVesselRoast,
  handleGetVesselLoveMeter,
  handleGetVesselPooling,
  handleGetVesselBreakup,
  handleGetVesselDivorce,
  handleGetVesselWelcome,
  handleGetVesselTrafficSignal,
  handleGetVesselTinderVoyage,
  handleGetVesselDowry,
  handleGetVesselGhosted,
  handleGetVesselCrossing,
  handleGetVesselAwards,
  handleGetVesselNearby,
};
export type { VesselRef };
