# How the server connects

This document explains how the emissions tool server in this repo wires itself
into the ZAP platform and out to its two upstream APIs. It's a map of the
connection points, not a feature spec.

## The pieces

| Piece | Location | Role |
| --- | --- | --- |
| Tool server | [server/](./server) | Fastify HTTP service exposing two GET operations + an OpenAPI doc |
| Domain metadata | [zap/domain.yaml](./zap/domain.yaml) | Names the domain (`emissions`) the platform mounts the server under |
| Platform config | [zap.config.mjs](./zap.config.mjs) | Points `zap serve` at the local server's OpenAPI URL |
| Widgets | [zap-widgets/](./zap-widgets) | React components the agent renders results into |
| Runner | [Makefile](./Makefile) | Convenience targets for booting both processes |

## Three connection hops

A request travels through three boundaries. Each is a distinct connection.

```
┌─────────────┐   1. OpenAPI mount      ┌──────────────────┐   2. upstream fetch   ┌────────────────────────┐
│  ZAP agent  │ ──────────────────────▶ │  this tool server │ ───────────────────▶  │  ZeroNorth upstream APIs │
│ (zap serve) │   GET /openapi.json     │   (Fastify :9001) │   bearer forwarded    │  data-lake / emission-  │
│             │   then GET /op?...      │                  │                       │  analytics (stage)      │
└─────────────┘                         └──────────────────┘                       └────────────────────────┘
        ▲                                                                                       
        │ 3. render into widget (agent passes result straight to show_emission_analytics)       
```

### Hop 1 — Platform ⇄ tool server (registration + calls)

The platform discovers and calls this server entirely over HTTP.

- **Where the connection is declared:** [zap.config.mjs](./zap.config.mjs) lists a
  local domain:
  ```js
  sources: {
    localDomains: [
      { path: "./zap", openApiUrl: "http://localhost:9001/openapi.json" },
    ],
  }
  ```
  `zap serve` fetches that `openApiUrl`, reads the OpenAPI doc, and registers each
  operation as an agent tool.

- **The OpenAPI doc** is served from [server/src/server.ts](./server/src/server.ts)
  at `GET /openapi.json` and is hand-authored in [server/src/spec.ts](./server/src/spec.ts).
  `"x-zap": { enabled: true }` opts the server into the platform.

- **Tool naming:** operation IDs are short (`get_vessel_emissions`,
  `get_vessel_noon_report`). The platform prepends the domain id from
  [zap/domain.yaml](./zap/domain.yaml) (`emissions`), so the agent sees
  `emissions_get_vessel_emissions` and `emissions_get_vessel_noon_report`.

- **The actual calls:** the agent issues plain HTTP GETs with query params, e.g.
  `GET /get_vessel_emissions?imo=...&year=...`. Routes are defined in
  [server/src/server.ts](./server/src/server.ts:76). The platform converts
  property names snake_case → camelCase at the boundary; the spec's prose
  describes the camelCase form the agent sees.

- **Port:** `PORT` env var, default **9001** ([server.ts:10](./server/src/server.ts#L10)).
  Bound on `0.0.0.0`.

### Hop 2 — Tool server ⇄ upstream APIs (token pass-through)

The server holds **no credentials of its own**. The ZAP platform attaches the
operator's `Authorization: Bearer <jwt>` header to every tool call, and the
server forwards it unchanged to the upstream. This is the key auth mechanism.

- `authOf()` in [server.ts:18](./server/src/server.ts#L18) pulls the header off
  the inbound request.
- It is threaded into each upstream client as `authHeader` and set verbatim as the
  `Authorization` header on the `fetch` ([data-lake.ts:478](./server/src/data-lake.ts#L478),
  [emission-analytics.ts:596](./server/src/emission-analytics.ts#L596)).
- `tenantOf()` decodes (does **not** verify) the JWT payload just to log which
  org the token carries. The token itself is never logged unless
  `DEBUG_LOG_TOKEN=1` is set.

There are **two distinct upstreams**, differing only in authorization:

| Client | Base URL (stage default) | Reachability with operator token |
| --- | --- | --- |
| [data-lake.ts](./server/src/data-lake.ts) | `https://dl.stage.zeronorth.app/data-lake` | **Reachable** — returns 200/404, never 403 |
| [emission-analytics.ts](./server/src/emission-analytics.ts) | `https://api.private.stage.zeronorth.app/emission-analytics-api` | **RBAC-gated** — currently `403 RBAC: access denied` until the platform team grants the role |

Both base URLs are overridable via env (`DATA_LAKE_BASE_URL`, `EMISSIONS_BASE_URL`).

**Upstream endpoints actually hit:**
- Noon report → `GET /canonical/latest-noon-report-pd?imo=...`
- FuelEU → `GET /vessel-fuel-eu-details/{imo}?year=...`
- CII → `GET /year-to-date-cii/{imo}`

### Hop 3 — Result ⇄ widget

The agent passes the tool result **straight** to `show_emission_analytics` (the
widget render tool) without reshaping. To make that safe, the `EmissionsResult`
schema in [spec.ts](./server/src/spec.ts) is kept field-for-field aligned with
the `emission_analytics` widget's input schema in
[zap-widgets/](./zap-widgets) — a lockstep contract. Change one side, change the
other.

## Graceful degradation (why connections failing doesn't 500)

Because the emission-analytics upstream is access-denied on stage, the handlers
are built to never propagate a 403/404 as a hard error:

- [get-vessel-emissions.ts](./server/src/handlers/get-vessel-emissions.ts): the
  `soft()` wrapper swallows 403 / 404 / fetch-failure and returns `null` instead
  of throwing. If neither CII nor FuelEU data comes back, the handler falls back
  to a **demo fixture** (`dataSource: "fixture"`) or, failing that, returns
  `dataAvailable: false` with a human-readable `message`. It is **always HTTP 200**.
- [get-vessel-noon-report.ts](./server/src/handlers/get-vessel-noon-report.ts):
  on a 404 it tries a fixture, else returns `status: "no_report"`. Also always 200.
- Only genuine upstream errors (a `DataLakeError`/`EmissionsError` that wasn't
  softened) map to `502`; unexpected errors map to `500`
  ([server.ts:61](./server/src/server.ts#L61)).

The `dataSource` field (`"live"` vs `"fixture"`) tells the agent — and the user —
whether the numbers are real or illustrative.

## Running both processes

The platform and the tool server are **two separate processes** that connect over
localhost. Start the tool server first so its OpenAPI is up when `zap serve`
fetches it.

```bash
# from repo root
make tools     # cd server && PORT=9001 npm start   → tool server on :9001
make serve     # zap serve --widgets ./zap-widgets   → platform on :3000
# or both at once (interleaved logs, Ctrl+C stops both):
make start
```

Supporting setup (see [README.md](./README.md)): `nvm use 24.16.0`,
`export AWS_PROFILE=zn-stage`, `aws sso login` when the SSO token expires. The
platform also resolves `LLM_API_KEY` from SSM per [zap.config.mjs](./zap.config.mjs).

Other useful targets: `make lint-spec` (zap lint the OpenAPI — server must be
running), `make eval` (run evals, which mock all tools and never hit the server),
`make stop` (free ports 9001 / 3000).
