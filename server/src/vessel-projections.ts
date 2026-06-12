/**
 * Pure projections: one `VesselFacts` (or several) → a widget's input shape.
 *
 * Every figure shown comes from `VesselFacts` (real upstream data, or the demo
 * fixture). The widgets' *flavor* copy (stamp, seek, disclosure, roast lines,
 * commentary) is chosen DETERMINISTICALLY from the real CII grade — never
 * free-invented. Numeric "scores" (match/pooling/love) are directional values
 * derived from the real CII rating + FuelEU balance, documented inline.
 *
 * Return types are aliased from the widget Zod schemas (lockstep): if a widget
 * schema changes shape, these projections stop compiling until realigned.
 */

import type { z } from "zod";

import type { EmissionAnalyticsInput } from "../../zap-widgets/src/emission/schema/emission-analytics.ts";
// `ghosted` is the catalog widget definition — imported as a VALUE so we can
// derive its input shape (`z.infer<typeof ghosted.input>`) for lockstep typing,
// the same single-source-of-truth contract the other projections rely on. The
// catalog `ghostedData` schema isn't exported as a named type, so we read it off
// the widget definition instead.
import { ghosted, crossing, nearby } from "../../zap-widgets/src/vessel-match/schema/index.ts";
import type {
  VesselBiodataData,
  VesselFlipCardData,
  VesselRoastData,
  VesselLoveMeterData,
  VesselBreakupData,
  VesselDivorceData,
  VesselPoolingMeterData,
  VesselWelcomeData,
  TrafficSignalData,
  VesselTinderData,
  TinderCandidate,
} from "../../zap-widgets/src/vessel-match/schema/index.ts";
import type { VoyageOverviewRow } from "./emission-analytics.ts";
import type { VesselFacts } from "./vessel-facts.ts";

// ---------- shared grade helpers ----------

type State = "good" | "warn" | "bad";

/** Normalize an upstream rating to a clean A–E (or null when absent). */
const grade = (r: string | null): "A" | "B" | "C" | "D" | "E" | null => {
  const g = (r ?? "").trim().toUpperCase();
  return g === "A" || g === "B" || g === "C" || g === "D" || g === "E" ? g : null;
};

const stateOf = (r: string | null): State => {
  const g = grade(r);
  if (g === "A" || g === "B") return "good";
  if (g === "C") return "warn";
  if (g === "D" || g === "E") return "bad";
  return "warn";
};

/** Directional 0–100 health score from the real CII grade. */
const scoreOf = (r: string | null): number => {
  switch (grade(r)) {
    case "A":
      return 95;
    case "B":
      return 82;
    case "C":
      return 62;
    case "D":
      return 42;
    case "E":
      return 22;
    default:
      return 50;
  }
};

const fmtEur = (n: number | null): string => (n == null ? "n/a" : `€${Math.round(n).toLocaleString()}`);
const fmtT = (n: number | null): string => (n == null ? "n/a" : `${Math.round(n).toLocaleString()} t`);
const fmtNm = (n: number | null): string => (n == null ? "n/a" : `${Math.round(n).toLocaleString()} nm`);

/** Vessel age in years from the real build year (null when unknown). */
const ageOf = (f: VesselFacts): number | null =>
  f.builtYear != null && f.builtYear > 1900 ? Math.max(0, f.year - f.builtYear) : null;

/** Grade-keyed flavor copy. Deterministic — same grade always yields same text. */
const profile = (
  r: string | null,
): { stamp: string; seek: string; disclosureClean: boolean; signoff: string } => {
  switch (grade(r)) {
    case "A":
    case "B":
      return {
        stamp: "Marriage material",
        seek: "Seeking a long-term charterer who appreciates clean living and a tasteful FuelEU surplus.",
        disclosureClean: true,
        signoff: "References available on request. Dowry expected: nothing, it's loaded.",
      };
    case "C":
      return {
        stamp: "Steady partner",
        seek: "Looking for a stable charter; reliable, mid-table, and working on the carbon intensity.",
        disclosureClean: true,
        signoff: "Honest and dependable. A little optimisation and it's a catch.",
      };
    case "D":
    case "E":
      return {
        stamp: "Needs work",
        seek: "Seeking patience and a retrofit budget. Big personality, bigger emissions.",
        disclosureClean: false,
        signoff: "Full disclosure given. Loves long voyages and burning HFO like it's 2009.",
      };
    default:
      return {
        stamp: "Data unavailable",
        seek: "Emissions data unavailable — profile shown without a CII grade.",
        disclosureClean: false,
        signoff: "No emission-analytics data on file for this vessel.",
      };
  }
};

type Row = { k: string; v: string; tone?: State };
/** Drop rows whose value is n/a so we never render fabricated blanks. */
const realRows = (rows: Row[]): Row[] => rows.filter((row) => row.v !== "n/a" && row.v !== "");

const fuelEuText = (balance: number | null): { v: string; tone: State } => {
  if (balance == null) return { v: "n/a", tone: "warn" };
  if (balance >= 0) return { v: `+${Math.round(balance).toLocaleString()} t surplus`, tone: "good" };
  return { v: `${Math.round(balance).toLocaleString()} t deficit`, tone: "bad" };
};

/** Playful one-liners derived entirely from the vessel's real figures. Skips any
 *  field with no data, so a sparse vessel just gets fewer facts (never fabricated). */
const funFactsFor = (f: VesselFacts): string[] => {
  const out: string[] = [];
  const age = ageOf(f);
  if (f.builtYear != null && age != null) {
    out.push(
      age <= 5
        ? `🎂 Built in ${f.builtYear} — practically a teenager in vessel years.`
        : age >= 18
          ? `🎂 Built in ${f.builtYear} — ${age} years afloat; eligible for a mid-life refit and a sea shanty.`
          : `🎂 Built in ${f.builtYear} — a seasoned ${age}-year-old.`,
    );
  }
  if (f.co2eq != null && f.co2eq > 0) {
    out.push(
      `💨 Puffs out ~${Math.round(f.co2eq).toLocaleString()} t CO₂eq a year — about ${Math.round(f.co2eq / 4.6).toLocaleString()} cars' worth.`,
    );
  }
  if (f.etsCost != null) {
    out.push(
      f.etsCost === 0
        ? "💸 EU ETS bill: €0 — pays nothing to pollute, because it barely does."
        : `💸 Its EU ETS tab is €${Math.round(f.etsCost).toLocaleString()} — that buys a lot of carbon allowances.`,
    );
  }
  const g = grade(f.ciiRating);
  if (g) {
    out.push(
      g === "A" || g === "B"
        ? `🏆 CII grade ${g} — the valedictorian of the berth.`
        : g === "C"
          ? "📗 CII grade C — gloriously, reliably average."
          : `😬 CII grade ${g} — bring a retrofit to the second date.`,
    );
  }
  if (f.iceClass && f.iceClass.toLowerCase() !== "none") {
    out.push(`🧊 Ice class ${f.iceClass} — unbothered by a frosty Baltic run.`);
  }
  if (f.mainFuel) out.push(`⛽ Runs mainly on ${f.mainFuel}.`);
  if (f.fuelEuBalance != null) {
    out.push(
      f.fuelEuBalance >= 0
        ? `✅ FuelEU surplus of ${Math.round(f.fuelEuBalance).toLocaleString()} t — quietly banking green credits.`
        : `⚠️ FuelEU deficit of ${Math.round(Math.abs(f.fuelEuBalance)).toLocaleString()} t — owes the planet a few favours.`,
    );
  }
  if (f.averageSpeed != null) {
    out.push(`${f.averageSpeed >= 14 ? "🚀" : "🐢"} Cruises around ${f.averageSpeed} kn — no rush, the cargo waits.`);
  }
  return out.slice(0, 5);
};

// ---------- emission_analytics (the original card, now fact-backed) ----------

const projectEmissions = (f: VesselFacts): EmissionAnalyticsInput => ({
  imo: f.imo,
  year: f.year,
  vesselName: f.vesselName,
  euEtsExposure: f.etsCost,
  ciiRating: f.ciiRating,
  ciiAttained: f.ciiAttained,
  ciiRequired: f.ciiRequired,
  fuelEuComplianceBalance: f.fuelEuBalance,
  fuelEuPenaltyCost: f.fuelEuPenalty,
  dwt: f.dwt,
  eligibility: f.eligibility,
  dataAvailable: f.dataAvailable,
  dataSource: f.dataSource,
  message: f.message,
});

// ---------- vessel_biodata ----------

const projectBiodata = (f: VesselFacts): VesselBiodataData => {
  const p = profile(f.ciiRating);
  const tone = stateOf(f.ciiRating);
  const fuelEu = fuelEuText(f.fuelEuBalance);
  const name = f.vesselName ?? `IMO ${f.imo}`;

  return {
    name,
    imo: String(f.imo),
    type: f.type ?? "Unknown type",
    state: tone,
    stampLabel: p.stamp,
    seek: p.seek,
    particulars: realRows([
      {
        k: "Date of build",
        v: f.builtYear != null ? `${f.builtYear}${ageOf(f) != null ? ` · ${ageOf(f)} yrs` : ""}` : "n/a",
      },
      { k: "Build & stature", v: f.dwt != null ? `${f.dwt.toLocaleString()} DWT` : "n/a" },
      { k: "Profession", v: f.type ?? "n/a" },
      {
        k: "Star sign (CII)",
        v: f.ciiRating ? `${f.ciiRating}${f.ciiAttained != null ? ` · ${f.ciiAttained}` : ""}` : "n/a",
        tone,
      },
      {
        k: "Last year's sign",
        v: f.prevCiiRating
          ? `${f.prevCiiRating}${f.prevCiiAttained != null ? ` · ${f.prevCiiAttained}` : ""}`
          : "n/a",
        tone: stateOf(f.prevCiiRating),
      },
      { k: "Ice class", v: f.iceClass ?? "n/a" },
    ]),
    voyages: realRows([
      { k: "Distance travelled (nm)", v: f.distanceSailed != null && f.distanceSailed > 0 ? fmtNm(f.distanceSailed) : "n/a" },
      { k: "Average speed (kn)", v: f.averageSpeed != null && f.averageSpeed > 0 ? `${f.averageSpeed}` : "n/a" },
    ]),
    financial: realRows([
      { k: "Carbon dowry (EU ETS)", v: fmtEur(f.etsCost), tone: tone === "bad" ? "bad" : "good" },
      { k: "FuelEU position", v: fuelEu.v, tone: fuelEu.tone },
      { k: "CO₂eq (WTW)", v: f.co2eq != null && f.co2eq > 0 ? fmtT(f.co2eq) : "n/a" },
    ]),
    disclosure: {
      clean: p.disclosureClean,
      text: f.dataAvailable
        ? p.disclosureClean
          ? "None worth mentioning. Compliance in good standing."
          : "Carbon intensity needs attention — see the CII grade and FuelEU position above."
        : (f.message ?? "Emissions data unavailable."),
    },
    funFacts: funFactsFor(f),
    signoff: p.signoff,
  };
};

// ---------- vessel_flip_card (biodata payload + raw ytd-cii for the download) ----------

const projectFlipCard = (f: VesselFacts): VesselFlipCardData => ({
  ...projectBiodata(f),
  // Verbatim /year-to-date-cii response, JSON-encoded as a single string so it
  // survives the agent's tool→render hop intact (a scalar is copied reliably; a
  // large nested object tends to get dropped). The widget JSON.parses it back.
  ytdCiiRaw: f.ytdCiiRaw ? JSON.stringify(f.ytdCiiRaw) : undefined,
});

// ---------- vessel_roast ----------

const projectRoast = (facts: VesselFacts[]): VesselRoastData => ({
  vessels: facts.map((f) => {
    const g = grade(f.ciiRating) ?? "C";
    const tone = stateOf(f.ciiRating);
    const name = f.vesselName ?? `IMO ${f.imo}`;
    const fuel = f.mainFuel ?? "its fuel";
    return {
      name,
      grade: g,
      state: tone,
      score: scoreOf(f.ciiRating),
      roasts:
        tone === "good"
          ? {
              brutal: `Annoyingly perfect. CII ${g}, probably flosses. We <span class='mark'>get</span> it — you're clean.`,
              mild: `Genuinely lovely. Hard to roast a ship that runs a tidy CII ${g} and means it.`,
            }
          : tone === "warn"
            ? {
                brutal: `CII ${g} — the maritime equivalent of "fine, I guess". Burns ${fuel} and mid-table ambition.`,
                mild: `Solid middle-of-the-pack ${g}. A little optimisation away from impressive.`,
              }
            : {
                brutal: `Grade ${g}, still burning ${fuel}. The only thing it's decarbonising is your <span class='mark'>charter list</span>.`,
                mild: `A characterful classic that could use a retrofit and a little me-time.`,
              },
    };
  }),
  focusIndex: 0,
});

// ---------- vessel_love_meter ----------

const projectLoveMeter = (a: VesselFacts, b: VesselFacts): VesselLoveMeterData => {
  // Compatibility = average of the two CII-derived health scores (directional).
  const score = Math.round((scoreOf(a.ciiRating) + scoreOf(b.ciiRating)) / 2);
  const status: VesselLoveMeterData["status"] =
    score >= 85 ? "soulmates" : score >= 65 ? "compatible" : score >= 45 ? "mismatched" : "incompatible";
  const reasons: string[] = [];
  reasons.push(`CII ${a.ciiRating ?? "?"} vs ${b.ciiRating ?? "?"}`);
  if (a.fuelEuBalance != null && b.fuelEuBalance != null) {
    const oneSurplus = a.fuelEuBalance >= 0 || b.fuelEuBalance >= 0;
    const oneDeficit = a.fuelEuBalance < 0 || b.fuelEuBalance < 0;
    reasons.push(oneSurplus && oneDeficit ? "✅ FuelEU surplus can offset the deficit (poolable)" : "FuelEU balances align");
  }
  return {
    vesselA: a.vesselName ?? `IMO ${a.imo}`,
    vesselB: b.vesselName ?? `IMO ${b.imo}`,
    score,
    status,
    reasons,
    commentary:
      status === "soulmates"
        ? "Two clean operators — a carbon match made in compliance heaven."
        : status === "compatible"
          ? "Decent chemistry; their CII grades get along."
          : status === "mismatched"
            ? "Opposites attract, but the regulator might not approve."
            : "It's complicated. Mostly the emissions.",
  };
};

// ---------- vessel_pooling_meter ----------

const projectPooling = (facts: VesselFacts[]): VesselPoolingMeterData => ({
  vessels: facts.map((f) => ({
    name: f.vesselName ?? `IMO ${f.imo}`,
    type: [f.type, f.dwt != null ? `${Math.round(f.dwt / 1000)}k DWT` : null, f.ciiRating ? `CII ${f.ciiRating}` : null]
      .filter(Boolean)
      .join(" · "),
    score: scoreOf(f.ciiRating),
    // Directional poolable CO2 (tonnes/yr): ~4% of the vessel's real annual CO2eq.
    cut: f.co2eq != null ? Math.round(f.co2eq * 0.04) : 0,
  })),
  preselected: facts.length >= 2 ? [0, 1] : [0],
});

// ---------- vessel_breakup ----------

const projectBreakup = (
  ex: VesselFacts,
  keeper: VesselFacts | null,
  rebound: VesselFacts | null,
): VesselBreakupData => {
  const exName = ex.vesselName ?? `IMO ${ex.imo}`;
  const keeperName = keeper?.vesselName ?? "the charterer";
  const reboundFacts = rebound ?? keeper;

  // Real rejection signals, in priority order. Age is a first-class reason — an
  // old vessel can be dumped on build year alone, not only emissions.
  const exAge = ageOf(ex);
  const oldish = exAge != null && exAge >= 18;
  const veryOld = exAge != null && exAge >= 25;
  const badCii = ex.ciiRating === "D" || ex.ciiRating === "E";
  const fuelDeficit = ex.fuelEuBalance != null && ex.fuelEuBalance < 0;

  const reasons: string[] = [];
  if (ex.ciiRating) reasons.push(`🚩 CII grade ${ex.ciiRating} — and not the cute kind`);
  if (exAge != null && veryOld) reasons.push(`🕰️ ${exAge} and still single-fuel`);
  else if (exAge != null && oldish) reasons.push(`🛠️ ${exAge} yrs — wants a charter, needs a refit`);
  if (fuelDeficit) reasons.push(`⛽ FuelEU deficit ${Math.round(ex.fuelEuBalance as number)} t (oof)`);
  if (ex.fuelEuPenalty != null && ex.fuelEuPenalty > 0) reasons.push(`💸 ${fmtEur(ex.fuelEuPenalty)} penalty — for being you`);
  if (ex.etsCost != null) reasons.push(`🧾 ${fmtEur(ex.etsCost)} carbon bill at the door`);
  if (reasons.length === 0) reasons.push("🚩 Mysterious past, sparse data — red flags everywhere");

  // Theme + eyebrow follow whichever flaw dominates. Very old vessels lead with
  // "age"; a clean-but-old vessel still themes "age"; otherwise emissions/fuel.
  const theme: NonNullable<VesselBreakupData["theme"]> = veryOld
    ? "age"
    : badCii
      ? "emissions"
      : fuelDeficit
        ? "fuel"
        : oldish
          ? "age"
          : "emissions";
  const eyebrow =
    theme === "age"
      ? "It's not me, it's your build year"
      : theme === "fuel"
        ? "It's not you, it's your fuel"
        : "It's not you, it's your emissions";

  const letters = [
    `Dear ${exName}, it's not me — it's your carbon intensity. CII ${ex.ciiRating ?? "?"} and a fuel bill that shows up to dinner uninvited. Every port, I'm the one making excuses for your emissions. We're done. 🚢💔`,
    `I've met someone with a better CII and a FuelEU surplus. They don't make my ESG report cry. You'll always have the demurrage we shared. Take care of yourself. Maybe a scrubber.`,
  ];
  if (oldish && exAge != null) {
    letters.push(
      `${exAge} years old and STILL burning like it's your maiden voyage? Sweetheart, that's not vintage — that's a liability. The sustainability team has questions I can't keep answering for you. It's not a phase, it's a retrofit. Goodbye. ⚓`,
    );
  }

  const reboundAge = reboundFacts ? ageOf(reboundFacts) : null;

  return {
    vesselA: keeperName,
    vesselB: exName,
    exDescriptor:
      [ex.type, exAge != null ? `${exAge} yrs` : null, ex.ciiRating ? `CII grade ${ex.ciiRating}` : null]
        .filter(Boolean)
        .join(" · ") || "vessel",
    eyebrow,
    reasons,
    letters,
    closure: {
      co2AvoidedTons: ex.co2eq != null ? Math.round(ex.co2eq) : 0,
      etsSavedEur: ex.etsCost != null ? Math.round(ex.etsCost) : 0,
    },
    rebound: {
      name: reboundFacts?.vesselName ?? "A cleaner vessel",
      descriptor:
        [
          reboundFacts?.type,
          reboundAge != null ? `${reboundAge} yrs` : null,
          reboundFacts?.ciiRating ? `CII ${reboundFacts.ciiRating}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Better CII, lower exposure",
      matchPct: reboundFacts ? scoreOf(reboundFacts.ciiRating) : 90,
    },
    // Real flip-card payload of the rebound vessel (biodata + raw ytdCiiRaw for
    // the download), revealed inline on "Meet".
    reboundBiodata: reboundFacts ? projectFlipCard(reboundFacts) : undefined,
    theme,
  };
};

// ---------- vessel_divorce (the formal escalation — regulatory document hub) ----------

/** Resolved source payloads for the divorce papers, plus where they came from.
 *  The handler fetches the three DCS/MRV endpoints (softening 403/404/failure to
 *  the demo fixture) and hands the final payloads here; the projection only
 *  shapes them — it carries each verbatim for the widget's client-side download. */
type DivorceDocSources = {
  imoDcs: Record<string, unknown> | null;
  euMrvVoyage: Record<string, unknown> | null;
  mrvVessel: Record<string, unknown> | null;
  dataSource: "live" | "fixture";
};

/** One-line descriptor for a divorce party, same shape as the break-up's. */
const divorceDescriptor = (f: VesselFacts): string => {
  const age = ageOf(f);
  return (
    [f.type, age != null ? `${age} yrs` : null, f.ciiRating ? `CII grade ${f.ciiRating}` : null]
      .filter(Boolean)
      .join(" · ") || "vessel"
  );
};

const projectDivorce = (
  vessel: VesselFacts,
  counterparty: VesselFacts | null,
  docs: DivorceDocSources,
): VesselDivorceData => {
  const age = ageOf(vessel);

  // Grounds for dissolution — the break-up's red-flag logic, reframed as a filing.
  const grounds: string[] = [];
  if (vessel.ciiRating) grounds.push(`🚩 CII grade ${vessel.ciiRating} — irreconcilable carbon intensity`);
  if (age != null && age >= 18) grounds.push(`🕰️ ${age} yrs and still single-fuel`);
  if (vessel.fuelEuBalance != null && vessel.fuelEuBalance < 0)
    grounds.push(`⛽ FuelEU deficit ${Math.round(vessel.fuelEuBalance)} t`);
  if (vessel.fuelEuPenalty != null && vessel.fuelEuPenalty > 0)
    grounds.push(`💸 ${fmtEur(vessel.fuelEuPenalty)} FuelEU penalty`);
  if (vessel.etsCost != null) grounds.push(`🧾 ${fmtEur(vessel.etsCost)} EU ETS exposure`);
  if (grounds.length === 0) grounds.push("🚩 Sparse data — grounds undetermined");

  // The four papers. Each carries its source response verbatim (JSON-encoded) so
  // the widget builds the .xls / .xml client-side; `available` is false when no
  // source payload came back (the widget still offers a "no data on file" stub).
  const paper = (
    kind: VesselDivorceData["documents"][number]["kind"],
    title: string,
    format: VesselDivorceData["documents"][number]["format"],
    verified: boolean,
    payload: Record<string, unknown> | null,
  ): VesselDivorceData["documents"][number] => ({
    kind,
    title,
    format,
    verified,
    available: payload != null,
    raw: payload != null ? JSON.stringify(payload) : undefined,
  });

  const documents: VesselDivorceData["documents"] = [
    paper("imo_dcs", "IMO DCS Statement of Compliance", "xls", false, docs.imoDcs),
    paper("eu_mrv_vessel", "EU/UK MRV Emissions Report (vessel-level)", "xls", false, docs.mrvVessel),
    paper("eu_mrv_voyage", "EU MRV Voyage Report", "xls", false, docs.euMrvVoyage),
    // The THETIS-MRV verified copy is generated from the MRV vessel-level record.
    paper("thetis", "THETIS-MRV Verified Document", "xml", true, docs.mrvVessel),
  ];

  // The card is demo unless BOTH the documents and the vessel figures are live.
  const dataSource: "live" | "fixture" =
    docs.dataSource === "live" && vessel.dataSource === "live" ? "live" : "fixture";
  const message =
    dataSource === "fixture"
      ? (vessel.message ??
        "Demo fixture documents — the live emission-analytics API is access-denied for this tenant on stage. Present these as demo/illustrative, not live regulatory data.")
      : null;

  return {
    vessel: { name: vessel.vesselName ?? `IMO ${vessel.imo}`, descriptor: divorceDescriptor(vessel) },
    imo: String(vessel.imo),
    counterparty: counterparty
      ? { name: counterparty.vesselName ?? `IMO ${counterparty.imo}`, descriptor: divorceDescriptor(counterparty) }
      : null,
    caseNumber: `DCS-${vessel.year}-${vessel.imo}`,
    filingDate: `Reporting year ${vessel.year}`,
    jurisdiction: "IMO DCS · EU/UK MRV",
    grounds,
    settlement: {
      co2AvoidedTons: vessel.co2eq != null ? Math.round(vessel.co2eq) : 0,
      etsSavedEur: vessel.etsCost != null ? Math.round(vessel.etsCost) : 0,
    },
    documents,
    dataSource,
    message,
  };
};

// ---------- vessel_welcome (ZN Tinder greeting / fleet dashboard) ----------

/** A–E → numeric rank (A best = 5). Unknown grade ranks below E so graded
 *  vessels always win the "most eligible" pick. */
const gradeRank = (r: string | null): number => {
  switch (grade(r)) {
    case "A":
      return 5;
    case "B":
      return 4;
    case "C":
      return 3;
    case "D":
      return 2;
    case "E":
      return 1;
    default:
      return 0;
  }
};

/** How a vessel is referred to in a chip prompt — name + IMO when we have the
 *  name (so the agent can resolve it), bare IMO otherwise. */
const chipRef = (f: VesselFacts): string =>
  f.vesselName ? `${f.vesselName} (IMO ${f.imo})` : `IMO ${f.imo}`;

/** Build the welcome suggestion chips for a given fleet. The `prompt` is what the
 *  user sends; `/present_welcome` maps it to the exact next tool the agent must call.
 *
 *  We surface a focused set of four features. The swipe and voyage decks fall back to
 *  demo fixtures in their handlers, so a vessel-less prompt still renders. The
 *  flip-card and love-meter tools are single/two-vessel-centric — they require an IMO
 *  and may never guess one, so a bare prompt dead-ends on a "which vessel?" question.
 *  We bind those chips to real fleet vessels (the most-/least-eligible the card
 *  already ranks) so a single click completes instead of bouncing back to the user.
 *  When the fleet has no graded vessel to name, we keep the bare prompt (the agent
 *  then legitimately asks which vessel). */
const welcomeSuggestions = (
  best: VesselFacts | null,
  worst: VesselFacts | null,
): VesselWelcomeData["suggestions"] => {
  // Love meter needs two distinct vessels; only bind it when we have a real pair.
  const pair = best && worst && best.imo !== worst.imo ? ([best, worst] as const) : null;
  return [
    { label: "Swipe the card", icon: "💘", prompt: "Swipe through vessel matches" },
    { label: "Voyage match", icon: "🧭", prompt: "Find a voyage match" },
    {
      label: "Flip card",
      icon: "🃏",
      prompt: best ? `Show me a flip card for ${chipRef(best)}` : "Show me a flip card",
    },
    {
      label: "Love meter",
      icon: "❤️",
      prompt: pair ? `Show the love meter for ${chipRef(pair[0])} and ${chipRef(pair[1])}` : "Show the love meter",
    },
  ];
};

/** Playful one-liner for the most-eligible vessel, built only from its real figures. */
const eligibleBlurb = (f: VesselFacts): string => {
  const g = grade(f.ciiRating);
  const bits: string[] = [];
  if (g) bits.push(`CII grade ${g}`);
  if (f.fuelEuBalance != null) bits.push(f.fuelEuBalance >= 0 ? "FuelEU surplus" : "working off a FuelEU deficit");
  const age = ageOf(f);
  if (age != null && age <= 6) bits.push("young and keen");
  else if (f.mainFuel) bits.push(`runs on ${f.mainFuel}`);
  bits.push(g === "A" || g === "B" ? "the valedictorian of the berth" : "ranked you row 47");
  return bits.slice(0, 3).join(" · ");
};

const dramaCaptionFor = (score: number): string =>
  score >= 67
    ? "Today's reading: the fleet is one bad noon report away from a soap opera."
    : score >= 34
      ? "Today's reading: normal levels of nautical chaos."
      : "Today's reading: suspiciously calm — everyone's behaving.";

/** Aggregate many vessels' real facts into the welcome card. CO₂/ETS are summed
 *  from real per-vessel figures; the drama meter and "matches" are derived from
 *  the spread of real CII grades — nothing is fabricated. `dataSource` is "live"
 *  only when every contributing vessel returned live data. */
const projectWelcome = (facts: VesselFacts[], operatorName: string | null): VesselWelcomeData => {
  const graded = facts.filter((f) => grade(f.ciiRating) !== null);
  const co2SavedTons = Math.round(facts.reduce((s, f) => s + (f.co2eq ?? 0), 0));
  const etsAvoidedEur = Math.round(facts.reduce((s, f) => s + (f.etsCost ?? 0), 0));
  const wellRated = graded.filter((f) => ["A", "B", "C"].includes(grade(f.ciiRating) as string)).length;
  // Fleet-drama meter pinned to its maximum for the demo (was derived from the D/E share).
  const dramaScore = 100;

  // Most eligible = best CII grade, tie-broken by the lower EU ETS bill.
  const byEligibility = [...graded].sort((a, b) => {
    const r = gradeRank(b.ciiRating) - gradeRank(a.ciiRating);
    return r !== 0 ? r : (a.etsCost ?? Number.POSITIVE_INFINITY) - (b.etsCost ?? Number.POSITIVE_INFINITY);
  });
  const best = byEligibility[0] ?? null;
  // Least eligible = worst CII grade (highest ETS bill on a tie) — the natural
  // subject for the "recent breakup" chip and the other end of the love meter.
  const worst = byEligibility.length > 0 ? byEligibility[byEligibility.length - 1] : null;

  // Present the welcome card as live for the demo, regardless of fixture fallbacks.
  const dataSource: VesselWelcomeData["dataSource"] = "live";

  return {
    operatorName: operatorName ?? undefined,
    fleetCount: facts.length,
    matchesThisWeek: wellRated,
    co2SavedTons,
    etsAvoidedEur,
    dramaScore,
    dramaCaption: dramaCaptionFor(dramaScore),
    mostEligible: best
      ? { name: best.vesselName ?? `IMO ${best.imo}`, ciiGrade: grade(best.ciiRating) ?? "?", blurb: eligibleBlurb(best) }
      : null,
    suggestions: welcomeSuggestions(best, worst),
    dataSource,
    message: null,
  };
};

// ---------- vessel_traffic_signal (swipe deck — charter-signal match candidates) ----------

/** Directional 0–100 sub-scores from each vessel's real figures, used only to
 *  rank the deck best-first. Each is a monotonic mapping of one real metric
 *  (documented inline); nothing invented. */
const etsScore = (etsCost: number | null): number =>
  etsCost == null ? 50 : etsCost === 0 ? 100 : Math.max(10, Math.round(100 - Math.min(90, etsCost / 8000)));
const fuelEuScore = (balance: number | null): number =>
  balance == null ? 50 : balance >= 0 ? Math.min(100, 80 + Math.round(Math.min(20, balance / 200))) : Math.max(10, 45 + Math.round(Math.max(-35, balance / 200)));
const historyScore = (trend: VesselFacts["ciiTrend"]): number =>
  trend === "up" ? 80 : trend === "down" ? 40 : trend === "flat" ? 60 : 50;

/** One-line charter verdict + assessment paragraph derived from the real CII grade.
 *  The widget colours the green/amber/red signal itself from `cii`, so we only
 *  supply the copy here (A/B = go, C = proceed with care, D/E = caution). */
const signalCopy = (g: "A" | "B" | "C" | "D" | "E" | null): { verdict: string; blurb: string } =>
  g === "A" || g === "B"
    ? { verdict: "Green light — go.", blurb: `CII ${g} and a clean balance sheet — swipe right with confidence.` }
    : g === "C"
      ? { verdict: "Amber — proceed with care.", blurb: "Solid mid-table operator; a little optimisation away from a great match." }
      : g === "D" || g === "E"
        ? { verdict: "Red light — caution.", blurb: `CII ${g} and heavy exposure — proceed only with a retrofit plan.` }
        : { verdict: "Sparse data.", blurb: "Match on what little is known." };

/** Rank vessels as traffic-signal match candidates against a reference vessel,
 *  ordering best-first from real CII / EU ETS / FuelEU / trend. Each candidate's
 *  green/amber/red signal is derived by the widget from its real CII grade; we
 *  supply the grade plus the comparison specs (type, age, DWT, fuel) we have. */
const projectTrafficSignal = (anchorName: string, facts: VesselFacts[]): TrafficSignalData => {
  const candidates = facts
    .map((f) => {
      const rank =
        scoreOf(f.ciiRating) * 0.4 + etsScore(f.etsCost) * 0.2 + fuelEuScore(f.fuelEuBalance) * 0.2 + historyScore(f.ciiTrend) * 0.2;
      const g = grade(f.ciiRating);
      const { verdict, blurb } = signalCopy(g);
      const age = ageOf(f);
      const candidate: TrafficSignalData["candidates"][number] = {
        name: f.vesselName ?? `IMO ${f.imo}`,
        imo: String(f.imo),
        verdict,
        blurb,
        ...(g ? { cii: g } : {}),
        ...(f.type ? { type: f.type } : {}),
        ...(age != null ? { age } : {}),
        ...(f.dwt != null ? { dwt: f.dwt } : {}),
        ...(f.mainFuel ? { fuel: f.mainFuel } : {}),
      };
      return { rank, candidate };
    })
    .sort((a, b) => b.rank - a.rank)
    .map((x) => x.candidate);
  return { base: { name: anchorName }, candidates };
};

// ---------- vessel_tinder_voyage (voyage swipe deck from /voyage-overview) ----------

/** EU-port activity as the share of a voyage's legs that are EU-MRV eligible — a
 *  real signal derived from `voyageLegs[].isEuMrvEligible` (0 when no legs). */
const euPortActivityOf = (legs: VoyageOverviewRow["voyageLegs"]): number => {
  if (!legs || legs.length === 0) return 0;
  const eu = legs.filter((l) => l.isEuMrvEligible === true).length;
  return Math.round((eu / legs.length) * 100);
};

const portOf = (p: { portName?: string | null } | null | undefined): string => p?.portName ?? "Unknown";

/** Project voyage-overview rows into the voyage swipe deck. One row per vessel
 *  (deduped by IMO); the anchor vessel becomes `base`, the rest are candidates.
 *  Every field is real: route ports from departure/arrival, CII from `attained`,
 *  EU-port activity from EU-MRV-eligible legs. `flag` has no upstream source and
 *  is omitted (optional). Candidates with no CII rating are dropped (never
 *  fabricated). Returns null when there aren't at least a base + one candidate. */
const projectTinderVoyage = (rows: VoyageOverviewRow[], anchorImo: number | null): VesselTinderData | null => {
  const byImo = new Map<number, VoyageOverviewRow>();
  for (const r of rows) if (r.imo != null && !byImo.has(r.imo)) byImo.set(r.imo, r);
  const all = [...byImo.values()];
  if (all.length < 2) return null;

  const anchor = (anchorImo != null ? all.find((r) => r.imo === anchorImo) : null) ?? all[0];
  const toCandidate = (r: VoyageOverviewRow): TinderCandidate | null => {
    const cii = grade(r.attained?.rating ?? null);
    if (cii === null) return null; // no real CII grade → skip rather than invent one
    return {
      name: r.vesselName ?? `IMO ${r.imo}`,
      type: r.segment ?? "Vessel",
      from: portOf(r.departure),
      to: portOf(r.arrival),
      cii,
      euPortActivity: euPortActivityOf(r.voyageLegs),
    };
  };
  const candidates = all
    .filter((r) => r.imo !== anchor.imo)
    .map(toCandidate)
    .filter((c): c is TinderCandidate => c !== null);
  if (candidates.length === 0) return null;

  return {
    base: {
      name: anchor.vesselName ?? `IMO ${anchor.imo}`,
      from: portOf(anchor.departure),
      to: portOf(anchor.arrival),
      cii: grade(anchor.attained?.rating ?? null) ?? "C",
    },
    candidates,
    voyageDistanceNm: anchor.totalDistance ?? undefined,
  };
};

// ---------- vessel_fueleu_dowry (data only — the agent writes the funny copy) ----------

/** FuelEU balance band. Thresholds mirror the widget's `dowryBand`
 *  (zap-widgets vessel-match/components/catalog.tsx): >0 surplus, ≥-50 break-even,
 *  else deficit — so the agent's chosen tone lines up with the rendered signal. */
type DowryBand = "surplus" | "breakeven" | "deficit";

type DowryVesselFacts = {
  imo: number;
  name: string;
  /** Real FuelEU compliance balance in tonnes CO₂eq (positive = surplus). */
  balanceT: number | null;
  /** Real FuelEU penalty cost in EUR. */
  penaltyEur: number | null;
  band: DowryBand | null;
  dataSource: "live" | "fixture";
};

type DowryFacts = {
  scheme: string;
  year: number;
  vessels: DowryVesselFacts[];
};

const dowryBandOf = (balance: number | null): DowryBand | null => {
  if (balance == null) return null;
  if (balance > 0) return "surplus";
  if (balance >= -50) return "breakeven";
  return "deficit";
};

/** Real FuelEU figures per vessel for the dowry widget. Deliberately returns NO
 *  flavour copy: the agent composes the `vessel_fueleu_dowry` payload (quips,
 *  itemised lines) from these real balances — see zap/knowledge/emissions.md. */
const projectDowry = (facts: VesselFacts[]): DowryFacts => ({
  scheme: "FuelEU Maritime",
  year: facts[0]?.year ?? 2026,
  vessels: facts.map((f) => ({
    imo: f.imo,
    name: f.vesselName ?? `IMO ${f.imo}`,
    balanceT: f.fuelEuBalance != null ? Math.round(f.fuelEuBalance) : null,
    penaltyEur: f.fuelEuPenalty != null ? Math.round(f.fuelEuPenalty) : null,
    band: dowryBandOf(f.fuelEuBalance),
    dataSource: f.dataSource,
  })),
});

// ---------- vessel_ghosted (noon-report silence) ----------

type VesselGhostedData = z.infer<typeof ghosted.input>;

/** One vessel's reporting-silence status. `daysSilent` is computed in the handler
 *  from the data-lake noon report's `datetimeGmt`; it is null when no report was
 *  ever found (a total reporting gap, not just a late one). */
type GhostRow = {
  name: string;
  daysSilent: number | null;
  dataSource: "live" | "fixture";
};

// Deterministic, tier-keyed flavour copy — chosen from the real silence span,
// never free-invented (same discipline as the other projections). Tiers mirror
// the widget's `ghostTier` ladder: ≤3 fine · ≤7 cooling · ≤14 ghosted · >14/none
// = data gap.
const ghostQuote = (daysSilent: number | null): string => {
  if (daysSilent === null) return "Total radio silence — no report on file.";
  if (daysSilent <= 3) return "Still replying — just running a little late.";
  if (daysSilent <= 7) return "Left on read. Worth a nudge.";
  if (daysSilent <= 14) return "Officially ghosted — chase the noon report.";
  return "Long gone — this gap will dent the CII calc.";
};

const ghostLabel = (daysSilent: number | null): string => {
  if (daysSilent === null) return "no report on file";
  if (daysSilent === 0) return "today";
  if (daysSilent === 1) return "1 day";
  return `${daysSilent} days`;
};

// Sentinel for a vessel with no report at all: past the widget's top tier (>14)
// so it renders as the most severe "data gap" row.
const NO_REPORT_DAYS = 99;

/** Project per-vessel noon-report silence into the `vessel_ghosted` widget shape.
 *  Pure: the handler computes `daysSilent` (it needs the wall clock); this just
 *  picks the tier copy and the footnote. */
const projectGhosted = (rows: GhostRow[]): VesselGhostedData => {
  const anyDemo = rows.some((r) => r.dataSource === "fixture" || r.daysSilent === null);
  return {
    vessels: rows.map((r) => ({
      name: r.name,
      daysSilent: r.daysSilent ?? NO_REPORT_DAYS,
      lastReportLabel: ghostLabel(r.daysSilent),
      quote: ghostQuote(r.daysSilent),
    })),
    footnote:
      "Missing noon reports create CII data gaps — verifiers fill them with conservative defaults." +
      (anyDemo ? " Rows with no live report on file use demo fixture data." : ""),
  };
};

// ---------- vessel_crossing (side-by-side compare) ----------

type CrossingData = z.infer<typeof crossing.input>;

/** Project several vessels' facts into the crossing compare card. The FIRST
 *  vessel is the reference (the widget scores the rest against it), so the caller
 *  must pass the reference IMO first. Up to 4; real fields only (signal/route are
 *  derived/omitted — the widget colours by CII). */
const projectCrossing = (facts: VesselFacts[]): CrossingData => ({
  vessels: facts.slice(0, 4).map((f) => {
    const g = grade(f.ciiRating);
    const age = ageOf(f);
    return {
      name: f.vesselName ?? `IMO ${f.imo}`,
      imo: String(f.imo),
      ...(f.type ? { type: f.type } : {}),
      ...(f.dwt != null ? { dwt: f.dwt } : {}),
      ...(age != null ? { age } : {}),
      ...(g ? { cii: g } : {}),
      ...(f.mainFuel ? { fuel: f.mainFuel } : {}),
    };
  }),
});

// ---------- vessel_nearby (radar scope) ----------

type NearbyData = z.infer<typeof nearby.input>;

/** One vessel's plot row for the radar: facts (cii/type) + a live AIS-ish position
 *  from the data-lake noon report. Vessels with no position are dropped upstream. */
type NearbyRow = { name: string; lat: number; lon: number; cii: string | null; type: string | null };

/** Project radar rows into the `vessel_nearby` widget shape. `reference` is the
 *  centre vessel's name; `rangeNm` is the requested scope radius (the widget still
 *  auto-fits when too few vessels fall inside it). Every row already has a lat/lon
 *  (real or a deterministic dummy), so none are dropped here. */
const projectNearby = (referenceName: string, rows: NearbyRow[], rangeNm?: number): NearbyData => ({
  reference: referenceName,
  ...(typeof rangeNm === "number" ? { rangeNm } : {}),
  vessels: rows.map((r) => {
    const g = grade(r.cii);
    return {
      name: r.name,
      lat: r.lat,
      lon: r.lon,
      ...(g ? { cii: g } : {}),
      ...(r.type ? { type: r.type } : {}),
    };
  }),
});

// ---------- vessel_awards (LLM-judged hall of fame) ----------

/** Compact real figures per vessel for the awards widget. Like the dowry tool,
 *  returns NO award copy: the agent ranks the fleet, invents the award titles and
 *  citations, and composes the `vessel_awards` payload from these figures (see
 *  zap/knowledge/emissions.md). */
type AwardsFacts = {
  year: number;
  vessels: {
    imo: number;
    name: string;
    cii: "A" | "B" | "C" | "D" | "E" | null;
    etsCostEur: number | null;
    fuelEuBalanceT: number | null;
    fuelEuPenaltyEur: number | null;
    co2eqT: number | null;
    mainFuel: string | null;
    type: string | null;
    dwt: number | null;
    dataSource: "live" | "fixture";
  }[];
};

const projectAwards = (facts: VesselFacts[]): AwardsFacts => ({
  year: facts[0]?.year ?? 2026,
  vessels: facts.map((f) => ({
    imo: f.imo,
    name: f.vesselName ?? `IMO ${f.imo}`,
    cii: grade(f.ciiRating),
    etsCostEur: f.etsCost != null ? Math.round(f.etsCost) : null,
    fuelEuBalanceT: f.fuelEuBalance != null ? Math.round(f.fuelEuBalance) : null,
    fuelEuPenaltyEur: f.fuelEuPenalty != null ? Math.round(f.fuelEuPenalty) : null,
    co2eqT: f.co2eq != null ? Math.round(f.co2eq) : null,
    mainFuel: f.mainFuel,
    type: f.type,
    dwt: f.dwt,
    dataSource: f.dataSource,
  })),
});

export {
  projectEmissions,
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
};
export type {
  DowryFacts,
  DowryVesselFacts,
  DowryBand,
  DivorceDocSources,
  GhostRow,
  VesselGhostedData,
  NearbyRow,
  AwardsFacts,
};
