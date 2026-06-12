/**
 * Hand-authored OpenAPI 3.0.3 spec for the Emissions tool server.
 *
 * Operation IDs are intentionally short — the platform prepends the domain id
 * (`emissions`, from zap/domain.yaml), so the agent sees e.g.
 * `emissions_get_vessel_emissions` and `emissions_get_vessel_noon_report`.
 *
 * Field descriptions are written for the agent: every field says what it is and
 * its units. The platform converts property names snake_case → camelCase at the
 * boundary; prose here references the camelCase form the agent actually sees.
 */

import { z } from "zod";

import {
  emissionAnalyticsInputSchema,
  vesselBiodataDataSchema,
  vesselFlipCardDataSchema,
  vesselRoastDataSchema,
  vesselLoveMeterDataSchema,
  vesselBreakupDataSchema,
  vesselDivorceDataSchema,
  vesselNoonReportDataSchema,
  vesselPoolingMeterDataSchema,
  vesselWelcomeDataSchema,
  welcomeActionSchema,
  trafficSignalDataSchema,
  vesselTinderDataSchema,
  ghosted,
  crossing,
  nearby,
} from "@0north/zap-widgets/schema";

/**
 * `EmissionsResult` is GENERATED from the `emission_analytics` widget's Zod input
 * schema — the widget is the single source of truth, so the tool-server response
 * and the widget input can never drift (the lockstep contract). The agent passes
 * this result STRAIGHT to `show_emission_analytics`; to change the shape, edit the
 * widget schema (zap-widgets/src/emission/schema/emission-analytics.ts) and the
 * spec follows automatically.
 *
 * `target: "openapi-3.0"` emits `nullable: true` (not `anyOf: [..., {type:"null"}]`)
 * and drops the JSON-Schema `$schema` key, so the result drops straight into this
 * OpenAPI 3.0.3 document. Every field's `.describe()` survives the conversion,
 * which keeps `zap lint` happy (it requires descriptions on agent-enabled ops).
 */
/**
 * Inline a generated schema's internal `definitions`/`$defs` and rewrite their
 * `#/definitions/...` $refs to the resolved value, returning a self-contained
 * schema with no internal refs. Widget schemas tagged with `.meta({ id })` (e.g.
 * biodata's shared row/tone) make `z.toJSONSchema` emit a `definitions` block +
 * `$ref`s — which DON'T resolve once the schema is nested inside this OpenAPI
 * document (the platform's ref-parser looks for `#/definitions/...` at the doc
 * root and fails). Inlining sidesteps that; duplicate inlined subtrees are fine
 * for an OpenAPI tool spec.
 */
const inlineDefs = (root: Record<string, unknown>): Record<string, unknown> => {
  const defs = (root.definitions ?? root.$defs ?? {}) as Record<string, unknown>;
  const resolve = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(resolve);
    if (node && typeof node === "object") {
      const ref = (node as Record<string, unknown>).$ref;
      if (typeof ref === "string" && (ref.startsWith("#/definitions/") || ref.startsWith("#/$defs/"))) {
        const key = ref.split("/").pop() as string;
        return resolve(defs[key]);
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = resolve(v);
      return out;
    }
    return node;
  };
  const cloned = resolve(root) as Record<string, unknown>;
  delete cloned.definitions;
  delete cloned.$defs;
  return cloned;
};

const emissionsResultSchema = inlineDefs(
  z.toJSONSchema(emissionAnalyticsInputSchema, { target: "openapi-3.0" }) as Record<string, unknown>,
);

/** Generate a self-contained OpenAPI-3.0 response schema from a widget's Zod input
 *  schema — same lockstep as `emissionsResultSchema`. Every vessel-tinder widget
 *  tool's response is generated this way, so the tool result is always exactly
 *  what the matching `show_vessel_*` render tool expects. */
const toOpenApi = (schema: z.ZodType) =>
  inlineDefs(z.toJSONSchema(schema, { target: "openapi-3.0" }) as Record<string, unknown>);

const vesselBiodataResult = toOpenApi(vesselBiodataDataSchema);
const vesselFlipCardResult = toOpenApi(vesselFlipCardDataSchema);
const vesselRoastResult = toOpenApi(vesselRoastDataSchema);
const vesselLoveMeterResult = toOpenApi(vesselLoveMeterDataSchema);
const vesselBreakupResult = toOpenApi(vesselBreakupDataSchema);
const vesselDivorceResult = toOpenApi(vesselDivorceDataSchema);
const vesselNoonReportResult = toOpenApi(vesselNoonReportDataSchema);
const vesselPoolingResult = toOpenApi(vesselPoolingMeterDataSchema);
const vesselWelcomeResult = toOpenApi(vesselWelcomeDataSchema);
const welcomeActionResult = toOpenApi(welcomeActionSchema);
const vesselTrafficSignalResult = toOpenApi(trafficSignalDataSchema);
const vesselTinderVoyageResult = toOpenApi(vesselTinderDataSchema);
// The `ghosted` catalog widget doesn't export a named data schema — read it off
// the widget definition's `.input` so the response stays in lockstep with it.
const vesselGhostedResult = toOpenApi(ghosted.input);
const vesselCrossingResult = toOpenApi(crossing.input);
const vesselNearbyResult = toOpenApi(nearby.input);

// Shared query parameters for the vessel-tinder tools.
const imoParam = {
  name: "imo",
  in: "query",
  required: true,
  description: "IMO number of the vessel (7-digit integer). Use a real IMO from the fleet; never guess one.",
  schema: { type: "integer", minimum: 1000000, maximum: 9999999 },
} as const;
const yearParam = {
  name: "year",
  in: "query",
  required: false,
  description: "Reporting year, e.g. 2026. Defaults to 2026 if omitted.",
  schema: { type: "integer", default: 2026 },
} as const;
const imosParam = {
  name: "imos",
  in: "query",
  required: true,
  description:
    "Comma-separated list of IMO numbers (7-digit) to include, e.g. '9920760,9113018'. Use real IMOs from the fleet (vessel_get_fleet_vessels); never guess.",
  schema: { type: "string" },
} as const;
const namesParam = {
  name: "names",
  in: "query",
  required: false,
  description: "Optional comma-separated display names aligned 1:1 with `imos`. Falls back to the IMO when absent.",
  schema: { type: "string" },
} as const;
const vesselNameParam = {
  name: "vesselName",
  in: "query",
  required: false,
  description: "Optional vessel name to echo back for the card header. Falls back to the IMO when absent.",
  schema: { type: "string" },
} as const;

const spec = {
  openapi: "3.0.3",
  "x-zap": { enabled: true },
  info: {
    title: "Emissions Analytics",
    version: "0.1.0",
    description:
      "Per-vessel emissions & regulatory compliance (EU ETS, CII, FuelEU) plus the latest operational noon report (position, fuel, weather).",
  },
  paths: {
    "/get_vessel_emissions": {
      get: {
        operationId: "get_vessel_emissions",
        summary: "Vessel emissions & regulatory compliance",
        description:
          "Real emissions and regulatory compliance for a single vessel by IMO: EU ETS exposure (EUR carbon cost), FuelEU compliance balance and penalty cost, and the attained vs required CII rating. Use whenever the user asks about a vessel's emissions, carbon cost, EU ETS, FuelEU, or CII grade. Never estimate these values — always call this tool. Always 200: inspect `dataAvailable`. When it is false, the figures are null and `message` explains why (commonly the operator/tenant lacks emission-analytics access on stage, or there is no data on file) — relay that to the user and do NOT fabricate numbers.",
        parameters: [
          {
            name: "imo",
            in: "query",
            required: true,
            description:
              "IMO number of the vessel (7-digit integer). Use a real IMO from the fleet (vessel_get_fleet_vessels); never guess one.",
            schema: { type: "integer", minimum: 1000000, maximum: 9999999 },
          },
          {
            name: "year",
            in: "query",
            required: false,
            description: "Reporting year, e.g. 2026. Defaults to 2026 if omitted.",
            schema: { type: "integer", default: 2026 },
          },
          {
            name: "vesselName",
            in: "query",
            required: false,
            description:
              "Optional vessel name to echo back for display (e.g. on the emission_analytics card header). If omitted the card falls back to the IMO.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Projected emissions & compliance figures. Inspect `dataAvailable`.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EmissionsResult" },
              },
            },
          },
        },
      },
    },
    "/get_vessel_noon_report": {
      get: {
        operationId: "get_vessel_noon_report",
        summary: "Latest noon report for a vessel",
        description:
          "Fetch the latest noon report for a vessel — the daily status entry a captain submits, from the ZeroNorth data-lake — and render it as the noon-report card. Returns position, course, speed, distance run in the last 24 h, observed weather, fuel ROBs, 24 h fuel consumption, and origin/destination ports. Use whenever the user asks about a vessel's noon report, where it is right now, its latest position / course / speed, how far it ran in the last day, the weather on board, or its current fuel on board / burn. Pass the result STRAIGHT to show_vessel_noon_report — do NOT reshape. Always 200: if `status` is 'ok' a noon report (or fixture) was found; if 'no_report', the card shows the gap and `message` says to fall back to the AIS trail. `dataSource` is 'live' from the data-lake or 'fixture' for a demo fallback in sparse tenants — mention 'demo fixture data' when it is 'fixture'. Pass `vesselName` when known so the card header shows the name.",
        parameters: [
          {
            name: "imo",
            in: "query",
            required: true,
            description:
              "IMO number of the vessel (7-digit integer). Use a real IMO from the fleet; never guess one.",
            schema: { type: "integer", minimum: 1000000, maximum: 9999999 },
          },
          vesselNameParam,
        ],
        responses: {
          "200": {
            description: "vessel_noon_report widget payload — pass it STRAIGHT to show_vessel_noon_report.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselNoonReport" } } },
          },
        },
      },
    },
    "/get_vessel_biodata": {
      get: {
        operationId: "get_vessel_biodata",
        summary: "Vessel biodata profile (matrimonial-style card)",
        description:
          "Real 'biodata' profile for one vessel by IMO: type, DWT, attained vs last-year CII, EU ETS cost, FuelEU position and CO₂eq, sourced from emission-analytics. Use this whenever the user asks for a single vessel's profile in any phrasing — \"biodata of <vessel>\", \"tell me about <vessel>\" / \"tell me about the vessel\", \"<vessel> details/detail\" / \"show details\", \"<vessel> portfolio\" / \"portfolio information\", \"who is <vessel>\", \"profile <vessel>\", \"show me <vessel>\", \"information\" / \"vessel information\" / \"information about <vessel>\", or \"what is this vessel\". This is the default card for any open-ended ask about a single vessel. The vessel may be named, given by IMO, or referred to contextually (\"this vessel\" / \"the vessel\") — in the contextual case, use the IMO of the vessel discussed earlier in the conversation, and ask which vessel if none has been established (never guess an IMO). Use emissions_get_vessel_emissions instead only when the user specifically asks for emissions / CII / EU ETS / FuelEU figures. Pass the result STRAIGHT to show_vessel_biodata — do NOT reshape. Always 200; figures fall back to demo fixture or read 'n/a' when the live API is unavailable.",
        parameters: [imoParam, yearParam, vesselNameParam],
        responses: {
          "200": {
            description: "vessel_biodata widget payload.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselBiodata" } } },
          },
        },
      },
    },
    "/get_vessel_flip_card": {
      get: {
        operationId: "get_vessel_flip_card",
        summary: "Vessel flip card (Tinder-style trading card)",
        description:
          "A playful 'flip card' / trading card for one vessel by IMO — a tappable card whose front shows the CII grade and key particulars and whose back flips to reveal full disclosure, fun facts and financial standing, with a download-to-PDF action. Backed by the SAME emission-analytics data as get_vessel_biodata. Use ONLY when the user explicitly asks for a \"flip card\", \"trading card\", \"card view\", or \"swipe card\" of a vessel. For any other single-vessel profile / details / biodata / information ask, use get_vessel_biodata instead (it is the default single-vessel card). The vessel may be named, given by IMO, or referred to contextually — never guess an IMO. Pass the result STRAIGHT to show_vessel_flip_card — do NOT reshape. Always 200; figures fall back to demo fixture or read 'n/a' when the live API is unavailable.",
        parameters: [imoParam, yearParam, vesselNameParam],
        responses: {
          "200": {
            description: "vessel_flip_card widget payload (biodata shape + optional raw ytdCiiRaw).",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselFlipCard" } } },
          },
        },
      },
    },
    "/get_vessel_roast": {
      get: {
        operationId: "get_vessel_roast",
        summary: "Humorous vessel roast deck",
        description:
          "Roast one or more vessels using their real CII grade and main fuel — a playful brutal/mild deck. Use when the user wants to roast a vessel or fleet. Pass the result STRAIGHT to show_vessel_roast.",
        parameters: [imosParam, namesParam, yearParam],
        responses: {
          "200": {
            description: "vessel_roast widget payload.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselRoast" } } },
          },
        },
      },
    },
    "/get_vessel_love_meter": {
      get: {
        operationId: "get_vessel_love_meter",
        summary: "Compatibility score for two vessels",
        description:
          "Playful compatibility score (0–100) between two vessels, derived from their real CII grades and FuelEU balances. Use when the user asks how compatible two vessels are. Pass the result STRAIGHT to show_vessel_love_meter.",
        parameters: [
          { name: "imoA", in: "query", required: true, description: "IMO of the first vessel.", schema: { type: "integer", minimum: 1000000, maximum: 9999999 } },
          { name: "imoB", in: "query", required: true, description: "IMO of the second vessel.", schema: { type: "integer", minimum: 1000000, maximum: 9999999 } },
          { name: "nameA", in: "query", required: false, description: "Optional display name for the first vessel.", schema: { type: "string" } },
          { name: "nameB", in: "query", required: false, description: "Optional display name for the second vessel.", schema: { type: "string" } },
          yearParam,
        ],
        responses: {
          "200": {
            description: "vessel_love_meter widget payload.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselLoveMeter" } } },
          },
        },
      },
    },
    "/get_vessel_pooling": {
      get: {
        operationId: "get_vessel_pooling",
        summary: "FuelEU pooling savings meter",
        description:
          "Directional pooled CO₂ savings across selected vessels: each vessel's score from its real CII grade and CO₂-avoidable from its real annual CO₂eq. Use when the user wants to pool vessels or see green-pooling savings. Pass the result STRAIGHT to show_vessel_pooling_meter.",
        parameters: [imosParam, namesParam, yearParam],
        responses: {
          "200": {
            description: "vessel_pooling_meter widget payload.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselPoolingMeter" } } },
          },
        },
      },
    },
    "/get_vessel_breakup": {
      get: {
        operationId: "get_vessel_breakup",
        summary: "Break-up letter for an incompatible vessel",
        description:
          "Cinematic 'break-up' with a poorly-performing vessel: red-flag reasons (CII grade, vessel age, FuelEU/EU ETS exposure), CO₂ and EU ETS saved by moving on (its real figures), and a cleaner rebound vessel with its biodata. Use when the user wants to dramatically reject a vessel OR asks why a vessel is/was rejected, e.g. \"break up with <vessel>\", \"reject <vessel>\", \"why is this vessel rejected\", \"why was <vessel> rejected\", \"why is <vessel> not a match\", \"what's wrong with <vessel>\". The vessel may be named, given by IMO, or referred to contextually (\"this vessel\" / \"the vessel\") — in the contextual case use the IMO of the vessel discussed earlier in the conversation, and ask which vessel if none has been established (never guess an IMO). ALWAYS pass a real reboundImo (a cleaner, better-CII fleet vessel): the closure scene's 'Meet' button reveals that rebound's flip card + biodata, so without reboundImo the rebound shows as a generic placeholder and 'Meet' has no card to display. Pass the result STRAIGHT to show_vessel_breakup.",
        parameters: [
          { name: "imo", in: "query", required: true, description: "IMO of the vessel being broken up with (the 'ex').", schema: { type: "integer", minimum: 1000000, maximum: 9999999 } },
          { name: "keeperImo", in: "query", required: false, description: "Optional IMO of the keeper vessel writing the letter.", schema: { type: "integer", minimum: 1000000, maximum: 9999999 } },
          { name: "reboundImo", in: "query", required: false, description: "Optional IMO of the better-matched rebound vessel.", schema: { type: "integer", minimum: 1000000, maximum: 9999999 } },
          { name: "exName", in: "query", required: false, description: "Optional display name for the ex vessel.", schema: { type: "string" } },
          { name: "keeperName", in: "query", required: false, description: "Optional display name for the keeper.", schema: { type: "string" } },
          { name: "reboundName", in: "query", required: false, description: "Optional display name for the rebound vessel.", schema: { type: "string" } },
          yearParam,
        ],
        responses: {
          "200": {
            description: "vessel_breakup widget payload.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselBreakup" } } },
          },
        },
      },
    },
    "/get_vessel_divorce": {
      get: {
        operationId: "get_vessel_divorce",
        summary: "Regulatory documents (IMO DCS / EU-UK MRV / THETIS) — the 'divorce papers'",
        description:
          "The regulatory-DOCUMENT hub for a single vessel, themed as a 'Decree of Dissolution of Charter' (the formal escalation of the break-up). Returns the vessel's downloadable official emissions papers — IMO DCS Statement of Compliance, EU/UK MRV vessel-level report, EU MRV voyage report, and the THETIS-MRV verified copy — plus the grounds and the CO₂ / EU ETS settlement. Use this whenever the user asks about a vessel's IMO DCS, EU MRV / UK MRV reports, THETIS-MRV, or wants to download / export its emissions documents or paperwork — e.g. \"IMO DCS report\", \"the MRV report for <vessel>\", \"download the emissions documents\", \"THETIS report\", \"export the report\". Also use it for the divorce framing: \"divorce <vessel>\", \"file for divorce\", \"make it official\". The vessel may be named, given by IMO, or referred to contextually (\"this vessel\" / \"the vessel\") — use the IMO discussed earlier in the conversation, and ask which vessel if none has been established (never guess an IMO). Single vessel only; pass `counterpartyImo` ONLY when the user frames it as a divorce from a specific keeper. NOTE the boundaries: for plain CII / EU ETS / FuelEU figures use get_vessel_emissions; for FuelEU compliance balance / pooling use get_vessel_dowry — this tool is specifically for the regulatory documents and their download. Always 200; `dataSource` is 'live' or 'fixture' (say 'demo fixture data' and quote `message` when 'fixture'). Pass the result STRAIGHT to show_vessel_divorce — do NOT reshape; the documents carry verbatim source payloads for the client-side download.",
        parameters: [
          { name: "imo", in: "query", required: true, description: "IMO of the vessel whose regulatory documents to file (the focal vessel).", schema: { type: "integer", minimum: 1000000, maximum: 9999999 } },
          { name: "counterpartyImo", in: "query", required: false, description: "Optional IMO of the keeper/petitioner vessel — only when the user frames this as a divorce from a specific vessel.", schema: { type: "integer", minimum: 1000000, maximum: 9999999 } },
          { name: "vesselName", in: "query", required: false, description: "Optional display name for the focal vessel.", schema: { type: "string" } },
          { name: "counterpartyName", in: "query", required: false, description: "Optional display name for the counterparty vessel.", schema: { type: "string" } },
          yearParam,
        ],
        responses: {
          "200": {
            description: "vessel_divorce widget payload (decree + downloadable regulatory papers).",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselDivorce" } } },
          },
        },
      },
    },
    "/get_vessel_welcome": {
      get: {
        operationId: "get_vessel_welcome",
        summary: "ZN Tinder welcome / greeting card",
        description:
          "Fetch the ZN Tinder welcome DATA: fleet stats aggregated from real emission-analytics data (total CO₂eq and EU ETS across the fleet, vessel count), today's most-eligible vessel (best CII grade), a fleet-drama meter, and the suggestion chips. Use this as the FIRST step whenever the user greets the assistant or asks how to get started — e.g. \"hi\", \"hey\", \"hello\", \"ahoy\", \"good morning\", \"what can you do\", \"get started\". First call vessel_get_fleet_vessels and pass the fleet's IMOs as `imos` so the stats reflect the real fleet; if you have no IMOs the tool falls back to demo fixture vessels. Then call `present_welcome`, passing this result STRAIGHT as its argument, to render the interactive card. Always 200; `dataSource` is 'live' only when every vessel returned live data, otherwise 'fixture' (say 'demo fixture data' and quote `message`).",
        parameters: [
          {
            name: "imos",
            in: "query",
            required: false,
            description:
              "Comma-separated list of fleet IMO numbers (7-digit) to aggregate, e.g. '9710022,9920760'. Get these from vessel_get_fleet_vessels; never guess. If omitted, the card falls back to demo fixture vessels.",
            schema: { type: "string" },
          },
          namesParam,
          yearParam,
          {
            name: "operatorName",
            in: "query",
            required: false,
            description: "Optional operator first name for the 'Ahoy, <name>' greeting. Omit if unknown.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Welcome data — pass it straight as the argument to present_welcome.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselWelcome" } } },
          },
        },
      },
    },
    "/present_welcome": {
      post: {
        operationId: "present_welcome",
        summary: "Render the interactive ZN Tinder welcome card",
        "x-zap-approval-widget": "vessel_welcome",
        description:
          "Render the interactive ZN Tinder welcome card and let the user pick an action. Call this RIGHT AFTER get_vessel_welcome, passing that tool's result STRAIGHT as the argument (the welcome data is the widget's input). The card renders with clickable chips; when the user clicks one, this returns { prompt, nextTool, renderTool }. You MUST immediately act on the result: call the tool named in `nextTool` (pass any IMO(s) embedded in `prompt`), then pass its result STRAIGHT to the tool named in `renderTool` to show the widget. Do NOT stop after this call and do NOT ask the user what to do next — the chip click IS the user's instruction. If `nextTool` is null, fall back to routing `prompt` yourself; if the user cancelled, just continue.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/VesselWelcomeAction" } } },
        },
        responses: {
          "200": {
            description:
              "The clicked chip resolved to its next tool. Call `nextTool`, then `renderTool` with its result.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/WelcomeRoute" } } },
          },
        },
      },
    },
    "/get_vessel_traffic_signal": {
      get: {
        operationId: "get_vessel_traffic_signal",
        summary: "Vessel Tinder traffic-signal swipe deck (ranked match candidates)",
        description:
          "A Tinder-style traffic-signal swipe deck of emissions-rated match candidates, ranked best-first. Each candidate card carries a green/amber/red charter signal and its key specs (CII, type, age, DWT, fuel), all derived from the vessel's REAL emission-analytics figures. THIS is the tool for 'find a match for ONE named vessel' — 'find/fine a match for <vessel>', 'match for <vessel>', 'good match for <vessel>', 'who should <vessel> pair with', 'swipe through vessel matches', 'find me a match', 'who should I pair / charter / pool with'. Set `anchorName` to the named vessel itself (the vessel you are matching FOR — it is the anchor, NOT a candidate); put the OTHER fleet vessels in `imos` as candidates. Do NOT use get_vessel_crossing for a single-vessel match, and never make a candidate the reference. First call vessel_get_fleet_vessels for the candidate IMOs; if omitted the deck falls back to demo fixture vessels. Pass the result STRAIGHT to show_vessel_traffic_signal — do NOT reshape.",
        parameters: [
          {
            name: "anchorName",
            in: "query",
            required: false,
            description:
              "What the deck is for — a vessel name, IMO, or cargo description (e.g. 'MV Nordic Aurora' or 'a Rotterdam→Singapore charter'). Shown as the deck header.",
            schema: { type: "string" },
          },
          {
            name: "imos",
            in: "query",
            required: false,
            description:
              "Comma-separated candidate IMO numbers (7-digit) to rank, e.g. '9710022,9920760'. Get these from vessel_get_fleet_vessels; never guess. If omitted, the deck falls back to demo fixture vessels.",
            schema: { type: "string" },
          },
          namesParam,
          yearParam,
        ],
        responses: {
          "200": {
            description: "vessel_traffic_signal widget payload (ranked candidate cards).",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselTrafficSignal" } } },
          },
        },
      },
    },
    "/get_vessel_tinder_voyage": {
      get: {
        operationId: "get_vessel_tinder_voyage",
        summary: "Vessel Tinder voyage match deck",
        description:
          "A playful 'voyage match' swipe deck built from the REAL voyage-overview dashboard: each candidate's route (departure → arrival ports), CII grade, and EU-port activity (the share of its voyage legs that are EU-MRV eligible) come from live voyage data. Use when the user wants a 'voyage match', to find a voyage buddy, or to match vessels by shared route / EU-port activity — e.g. \"voyage match\", \"find a voyage match\", \"who's sailing my route\". Optionally pass `imo` to anchor the deck on the user's own vessel (it becomes the `base`); otherwise the first voyage is the anchor. Pass the result STRAIGHT to show_vessel_tinder_voyage — do NOT reshape. Always 200; falls back to a demo deck when the live voyage API is unavailable (flag it as demo data). Note: `flag` is omitted (no upstream source).",
        parameters: [
          {
            name: "imo",
            in: "query",
            required: false,
            description:
              "Optional IMO of the user's own vessel to anchor the deck on (becomes the `base`). Get it from vessel_get_fleet_vessels; never guess. If omitted, the first voyage in the overview is the anchor.",
            schema: { type: "integer", minimum: 1000000, maximum: 9999999 },
          },
          yearParam,
        ],
        responses: {
          "200": {
            description: "vessel_tinder_voyage widget payload (base vessel + candidate deck).",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselTinderVoyage" } } },
          },
        },
      },
    },
    "/get_vessel_dowry": {
      get: {
        operationId: "get_vessel_dowry",
        summary: "Real FuelEU compliance balances (for the FuelEU 'dowry' card)",
        description:
          "Real FuelEU Maritime compliance balances for one or more vessels by IMO, from /vessel-fuel-eu-details — each vessel's compliance balance in tonnes CO₂eq (positive = surplus, negative = deficit), penalty cost in EUR, and a balance `band` (surplus / breakeven / deficit). This is the DEFAULT card for any FuelEU or EU-regulatory question about a vessel or fleet — call it whenever the user asks about FuelEU, a FuelEU 'dowry', pooling balances, what each vessel brings to a FuelEU pool, EU ports / EU port calls, EU voyages, EU compliance, EU regulations, or 'EU-related' standing in general. The vessel(s) may be named, given by IMO, or referred to contextually ('this vessel' / 'the fleet') — resolve to the IMO(s) discussed earlier in the conversation, and ask which vessel if none has been established (never guess an IMO). For a pure EU ETS carbon-cost figure only, use get_vessel_emissions instead. UNLIKE the other vessel widgets, this tool returns NUMBERS ONLY — it does not write any copy. After calling it, YOU compose the playful `vessel_fueleu_dowry` payload: keep the real `balanceT` per vessel, then write a witty matrimonial `quip` and itemised dowry lines from each real balance (surplus → 'brings a fat dowry'; deficit → 'marrying for love, are we?'), and pass that to show_vessel_fueleu_dowry. Never invent or alter the balance numbers. Always 200; `dataSource` is 'live' from emission-analytics or 'fixture' for the demo fallback (say 'demo fixture data' when 'fixture').",
        parameters: [imosParam, namesParam, yearParam],
        responses: {
          "200": {
            description: "Real FuelEU balances per vessel — the agent composes the dowry widget from these.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselDowryFacts" } } },
          },
        },
      },
    },
    "/get_vessel_ghosted": {
      get: {
        operationId: "get_vessel_ghosted",
        summary: "Vessels that have stopped sending noon reports ('ghosted')",
        description:
          "Real reporting-silence status for one or more vessels by IMO: how many days since each last sent a noon report, sourced from the data-lake (`/canonical/latest-noon-report-pd`). Use whenever the user asks which vessels have gone quiet / stopped reporting / 'ghosted' them, or about noon-report gaps, reporting health, or stale/overdue reports. The vessel(s) may be named, given by IMO, or referred to contextually ('the fleet') — resolve to real IMOs from the fleet (vessel_get_fleet_vessels); never guess one. Each row is severity-coded by days of silence (recent → cooling → ghosted → data gap); a vessel with no report on file renders as the most severe 'data gap' row. Missing noon reports create CII data holes, so this surfaces a real compliance risk behind the playful framing. Pass the result STRAIGHT to show_vessel_ghosted — do NOT reshape. Always 200; rows with no live report fall back to demo fixture data (noted in the footnote).",
        parameters: [imosParam, namesParam],
        responses: {
          "200": {
            description: "vessel_ghosted widget payload (per-vessel days of noon-report silence).",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselGhosted" } } },
          },
        },
      },
    },
    "/get_vessel_crossing": {
      get: {
        operationId: "get_vessel_crossing",
        summary: "Side-by-side comparison of up to 4 vessels",
        description:
          "Compare up to 4 vessels' real specs and CII side by side, scored against the FIRST vessel (the reference). ONLY use this when the user names TWO OR MORE specific vessels to compare ('compare X and Y', 'X vs Y'). Pass `imos` with the user's primary vessel FIRST so it is the reference, optional aligned `names`. For 'find a match for <one vessel>' do NOT use this — use get_vessel_traffic_signal anchored on that vessel instead (never put a candidate as the reference here). Get IMOs from vessel_get_fleet_vessels; never guess. Pass the result STRAIGHT to show_vessel_crossing.",
        parameters: [imosParam, namesParam, yearParam],
        responses: {
          "200": {
            description: "Crossing compare payload (vessels[], first = reference)",
            content: { "application/json": { schema: vesselCrossingResult } },
          },
        },
      },
    },
    "/get_vessel_awards": {
      get: {
        operationId: "get_vessel_awards",
        summary: "Real per-vessel figures for the fleet awards (you assign the awards)",
        description:
          "Returns compact REAL figures (CII, EU ETS cost, FuelEU balance & penalty, CO₂eq, fuel, type, DWT) for the given vessels. YOU then rank them, invent fitting award titles and a one-line citation each, split them into good/watch, and compose the show_vessel_awards payload — the figures are the evidence, the judgement is yours (never fabricate numbers). Use for 'give out the fleet awards', 'hall of fame', 'best & worst and why'. Get `imos` from vessel_get_fleet_vessels.",
        parameters: [imosParam, namesParam, yearParam],
        responses: {
          "200": {
            description: "Per-vessel award evidence (you compose the awards from this)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    year: { type: "integer" },
                    vessels: {
                      type: "array",
                      items: {
                        type: "object",
                        description:
                          "Real figures for one vessel: imo, name, cii (A–E or null), etsCostEur, fuelEuBalanceT, fuelEuPenaltyEur, co2eqT, mainFuel, type, dwt, dataSource ('live'|'fixture').",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/get_vessel_nearby": {
      get: {
        operationId: "get_vessel_nearby",
        summary: "Live positions of vessels for the radar scope",
        description:
          "Radar / 'what is near X'. Call this tool ALONE — it self-sources the fleet and every vessel's position internally, so do NOT call vessel_get_fleet_vessels or vessel_get_vessel_positions first; pass only `anchorName` (the vessel the user named) and optional `rangeNm`. Returns each vessel's latest AIS position (fleet-map AIS → data-lake noon report → demo position) plus CII and type; every vessel plots and the named centre always appears (no live position falls back to a demo position). `rangeNm` sets the scope radius in nautical miles (default 50) — pass the user's asked range, e.g. 25 for a tight scan or 200 for a wide one. `imos` is OPTIONAL: omit it to use the demo fleet around the named vessel; supply it only if the user already gave specific IMOs. Pass the result STRAIGHT to show_vessel_nearby.",
        parameters: [
          {
            name: "imos",
            in: "query",
            required: false,
            description:
              "OPTIONAL comma-separated IMO numbers to plot. Omit to let the tool use the demo fleet around `anchorName` — do NOT call a fleet-list tool just to fill this.",
            schema: { type: "string" },
          },
          namesParam,
          {
            name: "anchorName",
            in: "query",
            required: false,
            description: "Name of the centre vessel the radar is scoped around (the vessel the user named).",
            schema: { type: "string" },
          },
          {
            name: "rangeNm",
            in: "query",
            required: false,
            description: "Radar scope radius in nautical miles (default 50). Set this to the range the user asks for.",
            schema: { type: "integer", minimum: 1, maximum: 5000 },
          },
          yearParam,
        ],
        responses: {
          "200": {
            description: "Radar payload (reference + vessels[] with lat/lon)",
            content: { "application/json": { schema: vesselNearbyResult } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      // Generated from the emission_analytics widget's Zod schema at load time —
      // see `emissionsResultSchema` above. Do NOT hand-edit this shape here; edit
      // the widget schema and it flows through.
      EmissionsResult: emissionsResultSchema,
      // Generated from the vessel-tinder widget Zod schemas (see `toOpenApi` above) —
      // each is the exact input the matching show_vessel_* render tool expects.
      VesselBiodata: vesselBiodataResult,
      // The flip card carries the biodata payload PLUS an optional raw /year-to-date-cii
      // passthrough (`ytdCiiRaw`) for its download — generated from its own schema.
      VesselFlipCard: vesselFlipCardResult,
      VesselRoast: vesselRoastResult,
      VesselLoveMeter: vesselLoveMeterResult,
      VesselBreakup: vesselBreakupResult,
      VesselDivorce: vesselDivorceResult,
      VesselNoonReport: vesselNoonReportResult,
      VesselPoolingMeter: vesselPoolingResult,
      VesselWelcome: vesselWelcomeResult,
      VesselWelcomeAction: welcomeActionResult,
      // Hand-authored: what /present_welcome returns after a chip click. The server
      // resolves the clicked prompt to the exact next tool so the agent does not
      // have to interpret a routing table — it just calls `nextTool` then `renderTool`.
      WelcomeRoute: {
        type: "object",
        required: ["prompt", "nextTool", "renderTool"],
        properties: {
          prompt: {
            type: "string",
            description: "The chat phrase for the chip the user clicked (may embed a vessel name/IMO).",
          },
          nextTool: {
            type: "string",
            nullable: true,
            description:
              "The exact data tool to call next, e.g. 'emissions_get_vessel_traffic_signal'. Pass any IMO(s) found in `prompt`. Null when the prompt did not match a known chip — route it yourself then.",
          },
          renderTool: {
            type: "string",
            nullable: true,
            description:
              "The show_* render tool to pass `nextTool`'s result to, e.g. 'show_vessel_traffic_signal'. Null when `nextTool` is null.",
          },
        },
      },
      VesselTrafficSignal: vesselTrafficSignalResult,
      VesselTinderVoyage: vesselTinderVoyageResult,
      VesselGhosted: vesselGhostedResult,
      // Hand-authored: get_vessel_dowry returns REAL FuelEU numbers only (no widget
      // shape) — the agent composes the vessel_fueleu_dowry payload from these.
      VesselDowryFacts: {
        type: "object",
        required: ["scheme", "year", "vessels"],
        properties: {
          scheme: { type: "string", description: "Compliance scheme name — always 'FuelEU Maritime'." },
          year: { type: "integer", description: "Compliance year the balances are for." },
          vessels: {
            type: "array",
            description: "One entry per requested vessel, in the order the IMOs were supplied.",
            items: {
              type: "object",
              required: ["imo", "name", "balanceT", "penaltyEur", "band", "dataSource"],
              properties: {
                imo: { type: "integer", description: "Vessel IMO number." },
                name: { type: "string", description: "Display name (falls back to 'IMO <n>' when unknown)." },
                balanceT: {
                  type: "number",
                  nullable: true,
                  description:
                    "Real FuelEU compliance balance in tonnes CO₂eq (positive = surplus, negative = deficit). Null when no FuelEU data is on file — do not fabricate. Use this verbatim as the dowry card's balanceT.",
                },
                penaltyEur: {
                  type: "number",
                  nullable: true,
                  description: "Real FuelEU penalty cost in EUR. Null when unavailable.",
                },
                band: {
                  type: "string",
                  nullable: true,
                  enum: ["surplus", "breakeven", "deficit"],
                  description:
                    "Balance band derived from balanceT (>0 surplus, ≥-50 break-even, else deficit). Null when balanceT is null. Pick the matrimonial tone from this so it matches the rendered signal colour.",
                },
                dataSource: {
                  type: "string",
                  enum: ["live", "fixture"],
                  description:
                    "'live' = real emission-analytics figures. 'fixture' = demo fallback (RBAC-denied or no data); say 'demo fixture data' when this is 'fixture'.",
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export { spec };
