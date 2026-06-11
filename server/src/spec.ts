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

import { emissionAnalyticsInputSchema } from "../../zap-widgets/src/emission/schema/emission-analytics.ts";
import {
  vesselBiodataDataSchema,
  vesselRoastDataSchema,
  vesselTrafficSignalDataSchema,
  vesselLoveMeterDataSchema,
  vesselTinderMatchDataSchema,
  vesselBreakupDataSchema,
  vesselPoolingMeterDataSchema,
} from "../../zap-widgets/src/vessel-tinder/schema/index.ts";

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
const vesselRoastResult = toOpenApi(vesselRoastDataSchema);
const vesselTrafficSignalResult = toOpenApi(vesselTrafficSignalDataSchema);
const vesselLoveMeterResult = toOpenApi(vesselLoveMeterDataSchema);
const vesselMatchResult = toOpenApi(vesselTinderMatchDataSchema);
const vesselBreakupResult = toOpenApi(vesselBreakupDataSchema);
const vesselPoolingResult = toOpenApi(vesselPoolingMeterDataSchema);

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
          "Fetch the latest noon report for a vessel — the daily status entry a captain submits, from the ZeroNorth data-lake. Returns position, course, speed, distance run in the last 24 h, observed weather, fuel ROBs, 24 h fuel consumption, and origin/destination ports. Use this to ground operational facts (where the vessel is, how fast, how much fuel) instead of guessing. Always 200: if `report` is non-null use it; if null (`status: 'no_report'`), fall back to AIS trail (vessel_get_vessel_trail) and acknowledge the gap. `dataSource` is 'live' from the data-lake or 'fixture' for a demo fallback in sparse tenants — mention 'demo fixture data' when it is 'fixture'.",
        parameters: [
          {
            name: "imo",
            in: "query",
            required: true,
            description:
              "IMO number of the vessel (7-digit integer). Use a real IMO from the fleet; never guess one.",
            schema: { type: "integer", minimum: 1000000, maximum: 9999999 },
          },
        ],
        responses: {
          "200": {
            description:
              "Always 200. If `report` is non-null a noon report (or fixture) was found; if null, fall back to AIS + weather and quote `message`.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["imo", "status", "dataSource", "report", "message"],
                  properties: {
                    imo: { type: "integer", description: "Echoed IMO." },
                    status: {
                      type: "string",
                      enum: ["ok", "no_report"],
                      description:
                        "'ok' = report present (use `report`). 'no_report' = none on file (use vessel_get_vessel_trail for position).",
                    },
                    dataSource: {
                      type: "string",
                      enum: ["live", "fixture"],
                      description:
                        "'live' = from the data-lake. 'fixture' = a hand-authored demo fallback (only in tenants with sparse noon-report data). Mention 'demo fixture data' in the answer when this is 'fixture'.",
                    },
                    report: {
                      nullable: true,
                      description:
                        "The trimmed noon report when one was on file (or a fixture), otherwise null.",
                      allOf: [{ $ref: "#/components/schemas/NoonReportSummary" }],
                    },
                    message: {
                      type: "string",
                      nullable: true,
                      description:
                        "Populated for 'no_report' and fixture responses — a short human-readable explanation.",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/get_vessel_biodata": {
      get: {
        operationId: "get_vessel_biodata",
        summary: "Vessel biodata profile (matrimonial-style card)",
        description:
          "Real 'biodata' profile for one vessel by IMO: type, DWT, attained vs last-year CII, EU ETS cost, FuelEU position and CO₂eq, sourced from emission-analytics. Use this whenever the user asks for a single vessel's profile in any phrasing — \"biodata of <vessel>\", \"tell me about <vessel>\", \"<vessel> details/detail\", \"<vessel> portfolio\" / \"portfolio information\", \"who is <vessel>\", \"profile <vessel>\", or \"show me <vessel>\". This is the default card for an open-ended ask about one named vessel. Pass the result STRAIGHT to show_vessel_biodata — do NOT reshape. Always 200; figures fall back to demo fixture or read 'n/a' when the live API is unavailable.",
        parameters: [imoParam, yearParam, vesselNameParam],
        responses: {
          "200": {
            description: "vessel_biodata widget payload.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselBiodata" } } },
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
    "/get_vessel_traffic_signal": {
      get: {
        operationId: "get_vessel_traffic_signal",
        summary: "Green/amber/red charter screen",
        description:
          "Screen vessels for chartering, each rated green/amber/red from its real CII grade. Use when the user wants a go/caution/stop view across candidate vessels. Pass the result STRAIGHT to show_vessel_traffic_signal.",
        parameters: [
          imosParam,
          namesParam,
          {
            name: "anchorName",
            in: "query",
            required: false,
            description: "The charter or anchor vessel the screen is run for (card header).",
            schema: { type: "string" },
          },
          yearParam,
        ],
        responses: {
          "200": {
            description: "vessel_traffic_signal widget payload.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselTrafficSignal" } } },
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
    "/get_vessel_match": {
      get: {
        operationId: "get_vessel_match",
        summary: "Ranked vessel match deck",
        description:
          "Rank candidate vessels for a charter by a composite score built from real CII, EU ETS, FuelEU and history signals; builtYear/DWT come from /vessel-characteristics. Use when the user wants the best-matched vessels. Pass the result STRAIGHT to show_vessel_tinder_match.",
        parameters: [
          imosParam,
          namesParam,
          {
            name: "anchorName",
            in: "query",
            required: false,
            description: "The anchor (vessel, IMO, or cargo) the match deck was built for (card header).",
            schema: { type: "string" },
          },
          yearParam,
        ],
        responses: {
          "200": {
            description: "vessel_tinder_match widget payload.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VesselTinderMatch" } } },
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
          "Cinematic 'break-up' with a poorly-performing vessel: red-flag reasons, CO₂ and EU ETS saved by moving on (its real figures), and a cleaner rebound. Use when the user wants to dramatically reject a vessel. Pass the result STRAIGHT to show_vessel_breakup.",
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
      VesselRoast: vesselRoastResult,
      VesselTrafficSignal: vesselTrafficSignalResult,
      VesselLoveMeter: vesselLoveMeterResult,
      VesselTinderMatch: vesselMatchResult,
      VesselBreakup: vesselBreakupResult,
      VesselPoolingMeter: vesselPoolingResult,
      NoonReportSummary: {
        type: "object",
        required: ["imo", "datetimeGmt"],
        properties: {
          imo: { type: "integer", description: "IMO number." },
          voyageNr: { type: "string", nullable: true, description: "Voyage number string." },
          reportType: {
            type: "string",
            nullable: true,
            description: "Report type — e.g. 'noon_at_sea', 'arrival', 'departure', 'at_anchor'.",
          },
          datetimeGmt: {
            type: "string",
            format: "date-time",
            description: "Report timestamp in GMT (ISO 8601). Treat as authoritative.",
          },
          position: {
            type: "object",
            nullable: true,
            description: "Vessel position at noon.",
            properties: {
              latitude: { type: "number", nullable: true, description: "Decimal degrees." },
              longitude: { type: "number", nullable: true, description: "Decimal degrees." },
              courseOverGround: {
                type: "number",
                nullable: true,
                description: "Course over ground in degrees (0–360).",
              },
              speedOverGround: {
                type: "number",
                nullable: true,
                description: "Speed over ground in knots.",
              },
              distanceRun24h: {
                type: "number",
                nullable: true,
                description: "Distance run in the last 24 hours (nautical miles).",
              },
            },
          },
          weatherObserved: {
            type: "object",
            nullable: true,
            description: "Conditions reported by the captain at the time of the report.",
            properties: {
              windSpeedKn: { type: "number", nullable: true, description: "Wind speed in knots." },
              windDirectionDeg: {
                type: "number",
                nullable: true,
                description: "Wind direction in degrees (where the wind is FROM).",
              },
              waveHeightM: { type: "number", nullable: true, description: "Wave height in metres." },
              swellHeightM: { type: "number", nullable: true, description: "Swell wave height in metres." },
              beaufort: {
                type: "integer",
                nullable: true,
                description: "Beaufort wind force scale (0–12).",
              },
            },
          },
          bunkers: {
            type: "array",
            description: "Remaining-on-board per fuel grade (tonnes).",
            items: {
              type: "object",
              properties: {
                fuelGrade: {
                  type: "string",
                  nullable: true,
                  description: "Fuel grade name (e.g. 'VLSFO', 'MGO', 'HFO').",
                },
                robTonnes: { type: "number", nullable: true, description: "Tonnes remaining on board." },
              },
            },
          },
          consumption24h: {
            type: "array",
            description: "Fuel consumed in the last 24 h per grade (tonnes).",
            items: {
              type: "object",
              properties: {
                fuelGrade: { type: "string", nullable: true, description: "Fuel grade name." },
                consumedTonnes: {
                  type: "number",
                  nullable: true,
                  description: "Tonnes consumed in the last 24 hours.",
                },
              },
            },
          },
          originPort: { $ref: "#/components/schemas/PortRef" },
          destinationPort: { $ref: "#/components/schemas/PortRef" },
        },
      },
      PortRef: {
        type: "object",
        nullable: true,
        description: "A port reference (UN/LOCODE + name).",
        properties: {
          unlocode: {
            type: "string",
            nullable: true,
            description: "UN/LOCODE — 5-character port code (e.g. 'NLRTM' for Rotterdam).",
          },
          name: { type: "string", nullable: true, description: "Human-readable port name." },
          latitude: { type: "number", nullable: true, description: "Decimal degrees, if known." },
          longitude: { type: "number", nullable: true, description: "Decimal degrees, if known." },
        },
      },
    },
  },
} as const;

export { spec };
