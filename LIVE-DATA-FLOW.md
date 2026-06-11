# Live API data → widget: how real data flows

This document is the practical guide to (1) **turning on live emission-analytics
data** and (2) **tracing how a real upstream value lands in a rendered widget**.

> TL;DR: the tool server holds no credentials. It forwards the operator's bearer
> token to ZeroNorth's `emission-analytics-api`. Every widget's data is assembled
> once in [`gatherVesselFacts`](./server/src/vessel-facts.ts), projected into the
> widget's input shape, and handed to the agent — which passes it **straight** to
> the matching `show_vessel_*` render tool. When the live API is denied (403 RBAC)
> or empty, the server falls back to a demo fixture and marks `dataSource: "fixture"`.

---

## 1. What "live" depends on

There is no API key to set on the tool server. Live data depends on **three
things**, all about authorization, not configuration:

| Requirement | Where it comes from | If missing |
| --- | --- | --- |
| Operator bearer token | The ZAP platform attaches `Authorization: Bearer <jwt>` to every tool call | No token → upstream returns 401/403 → fixture fallback |
| `emission-analytics` RBAC role on that token | Granted by the ZAP platform team for the tenant | `403 RBAC: access denied` → fixture fallback |
| Reachable upstream | `EMISSIONS_BASE_URL`, defaults to the stage host | `fetch_failed` → fixture fallback |

So **"connect live data" = get the operator/tenant token granted the
`emission-analytics` role on stage.** Until then, the data-lake (noon report) is
live but emission-analytics returns 403, and you see demo-fixture figures.

### Environment knobs

| Env var | Default | Purpose |
| --- | --- | --- |
| `EMISSIONS_BASE_URL` | `https://api.private.stage.zeronorth.app/emission-analytics-api` | emission-analytics host ([emission-analytics.ts:13](./server/src/emission-analytics.ts#L13)) |
| `DATA_LAKE_BASE_URL` | `https://dl.stage.zeronorth.app/data-lake` | data-lake host (noon report) |
| `PORT` | `9001` | tool server port |
| `DEBUG_FACTS=1` | off | logs per-endpoint LIVE/— and raw values — the fastest way to confirm real data is flowing ([vessel-facts.ts](./server/src/vessel-facts.ts)) |
| `DEBUG_LOG_TOKEN=1` | off | logs the live operator token so you can replay it by hand (secret — never commit) |

### How to confirm you're getting LIVE data, not the fixture

1. **Check `dataSource` in the tool response.** `"live"` = real upstream;
   `"fixture"` = demo fallback. Every widget payload carries it.
2. **Turn on `DEBUG_FACTS=1`** and call a tool. You'll see one line per vessel:
   ```
   [facts] imo=9839131 vessel-details=LIVE ytd-cii=LIVE fuel-eu=LIVE characteristics=LIVE ... firstUpstreamStatus=null
   ```
   `firstUpstreamStatus=403` means the role isn't granted yet.
3. **Replay by hand:** with `DEBUG_LOG_TOKEN=1`, copy the bearer token from the
   logs into Swagger's Authorize box or `curl -H "Authorization: Bearer …"`
   against the upstream to see the raw response.

---

## 2. The upstream endpoints (the live sources)

All live emission figures come from **four** emission-analytics endpoints, called
in parallel per vessel ([vessel-facts.ts](./server/src/vessel-facts.ts)). The
noon-report tool uses a separate data-lake endpoint.

| Client fn ([emission-analytics.ts](./server/src/emission-analytics.ts)) | HTTP | Upstream path | Supplies |
| --- | --- | --- | --- |
| `getVesselDetails(imo, year)` | GET | `/vessel-details/{imo}?year=` | type, DWT, ice class, EU ETS cost & CO₂eq, performance (distance/speed), fuel mix, AER CII, eligibility flags |
| `getYearToDateCii(imo)` | GET | `/year-to-date-cii/{imo}` | attained CII + rating, required CII, prior-year CII |
| `getFuelEuDetails(imo, year)` | GET | `/vessel-fuel-eu-details/{imo}?year=` | FuelEU compliance balance, penalty cost |
| `getVesselCharacteristics([imo], year)` | POST | `/vessel-characteristics` (batch, JSON body) | build year (age), + secondary DWT / ice class / subtype / name |
| `getLatestNoonReport(imo)` | GET | `/canonical/latest-noon-report-pd?imo=` (data-lake) | position, weather, fuel ROB, consumption |

**Gotcha — nested upstream scalars.** Several fields are objects upstream, not
bare numbers. The client types and `gatherVesselFacts` extract the inner scalar:
- `requiredCii` → `{ cii, rating }`
- FuelEU `complianceBalance` → `{ balanceValue }`, `penaltyCost` → `{ penaltyValue }`
- ETS → `vesselEuEtsExposure.{ totalEuaCost, totalCo2Emission }`

Get this wrong and the value silently reads as `null`. `DEBUG_FACTS` prints the
raw JSON of exactly these fields so you can see whether the upstream nests them
differently.

---

## 3. The data flow, end to end

```
                                   Authorization: Bearer <operator jwt>
 ZAP agent ──GET /get_vessel_*?imo=&year=──▶ tool server (Fastify :9001)
                                                    │  authOf(headers) → token
                                                    ▼
                                  gatherVesselFacts(imo, year, token)   ◀── vessel-facts.ts
                                                    │  Promise.all, each wrapped in soft()
              ┌─────────────────────┬──────────────┼───────────────────┬──────────────────┐
              ▼                     ▼               ▼                   ▼
       /vessel-details      /year-to-date-cii  /vessel-fuel-eu    /vessel-characteristics
              └─────────────────────┴──────────────┴───────────────────┴──────────────────┘
                                                    │  extract nested scalars, normalize
                                                    ▼
                                       VesselFacts  { ciiRating, dwt, etsCost, … }
                                                    │  one normalized object per vessel
                                          ┌─────────┴──────────┐
                            dataAvailable?│                    │ no live figure?
                                     yes  │                    │ → getEmissionsFixture(imo)
                                          ▼                    ▼  dataSource:"fixture"
                                  project* (pure)  ◀── vessel-projections.ts
                                          │  VesselFacts → widget input shape
                                          ▼
                       widget-shaped JSON (e.g. EmissionAnalyticsInput, VesselBiodataData)
                                          │  returned as the tool result
                                          ▼
 ZAP agent ──passes result STRAIGHT (no reshape)──▶ show_emission_analytics / show_vessel_*
                                          ▼
                                   rendered widget in chat
```

### Step by step

1. **Agent → tool server.** The agent calls a tool, e.g.
   `emissions_get_vessel_emissions?imo=…&year=…`. The platform attaches the
   operator's `Authorization` header. Routes are in
   [server.ts](./server/src/server.ts) (`/get_vessel_emissions`,
   `/get_vessel_biodata`, `/get_vessel_roast`, `/get_vessel_traffic_signal`,
   `/get_vessel_love_meter`, `/get_vessel_match`, `/get_vessel_pooling`,
   `/get_vessel_breakup`, `/get_vessel_noon_report`).

2. **Token extraction & forward.** `authOf()` pulls the bearer token off the
   inbound request; it is threaded into every upstream `fetch` unchanged
   ([emission-analytics.ts](./server/src/emission-analytics.ts)). The server adds
   no credentials of its own.

3. **Fact gathering (the single source of truth).**
   [`gatherVesselFacts`](./server/src/vessel-facts.ts) fires the four
   emission-analytics calls in parallel, each wrapped in `soft()` so that
   403 / 404 / 5xx / fetch-failure resolves to `null` instead of throwing. It then
   normalizes everything into one `VesselFacts` object (rounds CII to 2 dp,
   upper-cases ratings, picks the dominant fuel, computes the YoY CII trend, and
   reads each nested upstream scalar). **Every widget derives only from this** —
   the upstream wiring lives in exactly one place, so widgets can never invent data.

4. **Live-vs-fixture decision.** `dataAvailable` is true if any headline figure
   (`ciiRating`, `dwt`, `etsCost`, `fuelEuBalance`) came back. If true →
   `dataSource: "live"`, return facts. If nothing usable → fall back to
   `getEmissionsFixture(imo)` (`dataSource: "fixture"`, with a `message`
   explaining why), or, if no fixture exists, return `dataAvailable: false` and an
   honest message. **The endpoint is always HTTP 200** — failures are data, not
   exceptions.

5. **Projection (pure, deterministic).**
   [vessel-projections.ts](./server/src/vessel-projections.ts) maps `VesselFacts`
   → each widget's input shape. Numbers shown are real figures from facts; the
   *flavor* copy (stamps, roast lines, scores) is chosen deterministically from
   the real CII grade — never free-invented. `realRows()` drops any `n/a` field so
   a sparse vessel renders fewer facts rather than fabricated blanks.

6. **Agent → render tool.** The agent passes the projection **straight** to the
   matching `show_*` widget tool, no reshaping. That's safe because of the
   lockstep contract (next section).

---

## 4. The lockstep contract (why the shape is guaranteed to fit the widget)

The tool result shape **is** the widget's input shape — they aren't redeclared,
they're imported across the package boundary:

- [handlers/get-vessel-emissions.ts](./server/src/handlers/get-vessel-emissions.ts)
  and [vessel-projections.ts](./server/src/vessel-projections.ts) import the widget
  Zod-derived types by relative path:
  ```ts
  import type { EmissionAnalyticsInput }
    from "../../zap-widgets/src/emission/schema/emission-analytics.ts";
  import type { VesselBiodataData, VesselRoastData, … }
    from "../../zap-widgets/src/vessel-tinder/schema/index.ts";
  ```
- The projections' **return types are aliased from those widget schemas**. If a
  widget schema changes shape, the projections stop compiling until realigned —
  so the data the agent forwards always matches what the widget expects.
- The OpenAPI `EmissionsResult` schema in [spec.ts](./server/src/spec.ts) mirrors
  the same source of truth, so the agent-visible tool contract and the widget
  contract can't drift apart.

**Change one side, change the other.** This is the mechanism that lets the agent
pass real data through untouched.

---

## 5. Running it against live data

```bash
# 1. Make sure the operator/tenant token has the emission-analytics role granted.
#    (Until then you'll get dataSource:"fixture" — that's expected on stage.)

# 2. Start the tool server (real upstream, verbose fact logging)
cd server
DEBUG_FACTS=1 PORT=9001 npm start        # or: make tools

# 3. Start the platform so the agent can call the tools
make serve                                # zap serve --widgets ./zap-widgets

# 4. Ask the agent something that triggers a tool, then check the logs:
#    [facts] … vessel-details=LIVE ytd-cii=LIVE … firstUpstreamStatus=null   ← real data
#    [facts] … vessel-details=—    ytd-cii=—    … firstUpstreamStatus=403    ← still gated
```

To point at a different environment, override the base URLs:
```bash
EMISSIONS_BASE_URL=https://…/emission-analytics-api \
DATA_LAKE_BASE_URL=https://…/data-lake \
PORT=9001 npm start
```

---

## 6. Quick reference — files in the live-data path

| File | Role in the flow |
| --- | --- |
| [server/src/server.ts](./server/src/server.ts) | Routes, token extraction (`authOf`), error mapping, always-200 handlers |
| [server/src/emission-analytics.ts](./server/src/emission-analytics.ts) | Typed client for the four emission-analytics endpoints; forwards the token |
| [server/src/data-lake.ts](./server/src/data-lake.ts) | Typed client for the noon-report endpoint |
| [server/src/vessel-facts.ts](./server/src/vessel-facts.ts) | **The hub** — gathers + normalizes one vessel's real facts; live/fixture decision |
| [server/src/vessel-projections.ts](./server/src/vessel-projections.ts) | Pure `VesselFacts` → widget input shape |
| [server/src/handlers/](./server/src/handlers/) | One thin handler per tool: gather facts → project |
| [server/src/emissions-fixtures.ts](./server/src/emissions-fixtures.ts) | Demo fallback figures (used only when live is denied/empty) |
| [server/src/spec.ts](./server/src/spec.ts) | OpenAPI doc the platform reads to register the tools |
| zap-widgets `…/schema` | The widget input schemas the projections are pinned to (lockstep) |
