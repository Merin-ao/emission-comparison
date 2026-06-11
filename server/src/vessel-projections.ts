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

import type { EmissionAnalyticsInput } from "../../zap-widgets/src/emission/schema/emission-analytics.ts";
import type {
  VesselBiodataData,
  VesselRoastData,
  VesselTrafficSignalData,
  VesselLoveMeterData,
  VesselTinderMatchData,
  VesselBreakupData,
  VesselPoolingMeterData,
} from "../../zap-widgets/src/vessel-tinder/schema/index.ts";
import type { VesselFacts } from "./vessel-facts.ts";

// ---------- shared grade helpers ----------

type State = "good" | "warn" | "bad";
type Signal = "green" | "amber" | "red";

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

const signalOf = (r: string | null): Signal => {
  const s = stateOf(r);
  return s === "good" ? "green" : s === "warn" ? "amber" : "red";
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

// ---------- vessel_traffic_signal ----------

const projectTrafficSignal = (anchorName: string, facts: VesselFacts[]): VesselTrafficSignalData => ({
  anchorName,
  candidates: facts.map((f) => {
    const sig = signalOf(f.ciiRating);
    const g = f.ciiRating ?? "?";
    return {
      name: f.vesselName ?? `IMO ${f.imo}`,
      imo: `IMO ${f.imo}`,
      signal: sig,
      badge: `CII ${g}`,
      verdict:
        sig === "green" ? "Green light — go." : sig === "amber" ? "Amber — proceed with caution." : "Red — stop.",
      advice:
        sig === "green"
          ? "Strong CII standing; clear to charter on emissions grounds."
          : sig === "amber"
            ? "Acceptable but watch the CII trend and FuelEU balance before committing."
            : "Weak CII / compliance position — expect EU ETS cost and FuelEU penalty exposure.",
      typeAge: `${f.type ?? "Vessel"} · ${ageOf(f) != null ? `${ageOf(f)}y` : "age n/a"}`,
      ciiFuel: `${g} · ${f.mainFuel ?? "n/a"}`,
      route: "Route n/a",
    };
  }),
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

// ---------- vessel_tinder_match ----------

const verdictOf = (score: number): VesselTinderMatchData["cards"][number]["verdict"] =>
  score >= 85 ? "strong_match" : score >= 65 ? "consider" : score >= 45 ? "weak_match" : "reject";

const projectMatch = (anchorName: string, facts: VesselFacts[]): VesselTinderMatchData => {
  const cards = facts
    .map((f) => {
      const ciiScore = scoreOf(f.ciiRating);
      // Directional sub-scores from real signals (0–100).
      const fuelEuScore = f.fuelEuBalance == null ? 50 : f.fuelEuBalance >= 0 ? 90 : 35;
      const euEtsScore = f.etsCost == null ? 50 : f.etsCost < 300_000 ? 80 : f.etsCost < 600_000 ? 55 : 30;
      const historyScore = f.prevCiiRating ? scoreOf(f.prevCiiRating) : ciiScore;
      const matchScore = Math.round(ciiScore * 0.45 + fuelEuScore * 0.25 + euEtsScore * 0.2 + historyScore * 0.1);
      return {
        imo: String(f.imo),
        name: f.vesselName ?? `IMO ${f.imo}`,
        segment: f.type ?? "Unknown",
        dwt: f.dwt ?? 0,
        builtYear: f.builtYear ?? 0, // real, from /vessel-characteristics; 0 only when upstream has none
        fuel: f.mainFuel ?? "n/a",
        matchScore,
        verdict: verdictOf(matchScore),
        headlineReason: `CII ${f.ciiRating ?? "?"}${f.fuelEuBalance != null ? (f.fuelEuBalance >= 0 ? ", FuelEU surplus" : ", FuelEU deficit") : ""}`,
        subScores: { cii: ciiScore, euEts: euEtsScore, fuelEu: fuelEuScore, history: historyScore },
      };
    })
    .sort((x, y) => y.matchScore - x.matchScore);
  return { anchorName, cards };
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
  const reasons: string[] = [];
  if (ex.ciiRating) reasons.push(`🚩 CII grade ${ex.ciiRating}`);
  if (ex.fuelEuBalance != null && ex.fuelEuBalance < 0) reasons.push(`💸 FuelEU deficit ${Math.round(ex.fuelEuBalance)} t`);
  if (ex.fuelEuPenalty != null && ex.fuelEuPenalty > 0) reasons.push(`💸 ${fmtEur(ex.fuelEuPenalty)} FuelEU penalty`);
  if (ex.etsCost != null) reasons.push(`💸 ${fmtEur(ex.etsCost)} EU ETS bill`);
  if (reasons.length === 0) reasons.push("🚩 Emissions data sparse — proceed with caution");

  return {
    vesselA: keeperName,
    vesselB: exName,
    exDescriptor: [ex.type, ex.ciiRating ? `CII grade ${ex.ciiRating}` : null].filter(Boolean).join(" · ") || "vessel",
    eyebrow: "It's not you, it's your emissions",
    reasons,
    letters: [
      `Dear ${exName} — every port we enter, I'm the one explaining your emissions. CII ${ex.ciiRating ?? "?"} and a carbon bill I can't keep covering for. It's time we sailed separate routes.`,
      `It's not that I don't care. It's that your numbers hit my ESG report harder than you hit your CII target. You need a retrofit, not a charterer.`,
    ],
    closure: {
      co2AvoidedTons: ex.co2eq != null ? Math.round(ex.co2eq) : 0,
      etsSavedEur: ex.etsCost != null ? Math.round(ex.etsCost) : 0,
    },
    rebound: {
      name: reboundFacts?.vesselName ?? "A cleaner vessel",
      descriptor:
        [reboundFacts?.type, reboundFacts?.ciiRating ? `CII ${reboundFacts.ciiRating}` : null].filter(Boolean).join(" · ") ||
        "Better CII, lower exposure",
      matchPct: reboundFacts ? scoreOf(reboundFacts.ciiRating) : 90,
    },
    theme: "emissions",
  };
};

export {
  projectEmissions,
  projectBiodata,
  projectRoast,
  projectTrafficSignal,
  projectLoveMeter,
  projectMatch,
  projectPooling,
  projectBreakup,
};
