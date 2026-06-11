# DX Feedback for the ZAP core team

A running, dated log of friction points, surprises, and "huh, nice" moments while building **Captain's Log** on ZAP. Targets the *Best Developer Experience Feedback* prize category — the deal is specificity over completeness.

Each entry: what I was trying to do, what I expected, what actually happened, why it mattered.

---

## 2026-06-10 — Onboarding & first tool server

### Good

- **`zap lint --probe` is gold.** Running it against my fresh OpenAPI spec immediately said "no gaps found, agent-ready" for each operation. That single command + the structured probe output is the most concretely useful "is my spec good?" feedback I've gotten from any agent-tool platform. Keep it.
- **The `x-zap.enabled` root flag is a great default.** Letting me opt the whole spec in with one line, while keeping per-operation override, hit the sweet spot for a small focused tool server like this one. I didn't have to think about it.
- **Domain-id prefixing is invisible.** I wrote `operationId: find_vessel` and the platform handled the `captains_log_` prefix at registration. Means I can rename a domain without touching the spec.
- **Skills system worked.** Loading `zap-platform` then `zap-build-tool-server` got me from "what is ZAP" to "shipping an OpenAPI" without going outside the CLI. The skill explicitly told me when to defer to a sibling (`zap-build-widget`, `zap-write-eval`), which I appreciated.

### Friction

- **`zap.config.mjs` shape is undocumented vs CLI flags.** My first config had `remoteDomains: ["ai-infra"]` because I assumed the CLI flag `--remote-domains` had a config equivalent. It doesn't — `--remote-domains` is a boolean. The error mode was silent (no warning that an unknown config key was ignored). A `zap serve` startup warning that unknown top-level config keys are being ignored would have caught this.
- **The setup guide example for `zap.config.mjs` shows `widgets: "../zap-widgets"` (sibling-of-cwd path) but the schema isn't documented anywhere I can find — I had to guess that `./widgets` (submodule under cwd) works the same way. A short reference doc with the config schema (or even a TypeScript type) would have removed that guess.
- **Stage / demo-tenant data is sparse in inconsistent ways.** This is the biggest one. I designed Captain's Log around the noon-report substrate (`/canonical/latest-noon-report-pd`) because the OpenAPI schema looked rich and exactly fit the use case. After scaffolding, I tested against the demo tenant and found:
  - **0 noon reports** across the entire tenant (`count: 0` from both `/canonical/noon-reports/` and `/canonical/noon-reports-mda`).
  - **Fleet roster has 78 vessels**, mostly named "Demo", "Demo 1", "Vessel A/B/C".
  - **Voyages exist but only for 1 IMO (9920760), all dated 2022.**
  - **AIS trails are LIVE and real** for at least IMO 9920760 (current position in the Arabian Sea, hourly updates).
  - **Bunker prices via Marvin are LIVE and rich.**
  - **`/fleet-manager/vessel-status-record` requires POST not GET** — the OpenAPI spec lists it under `get:` but `GET` returns 405.

  The mismatch between "the OpenAPI schemas look ready to demo" and "the demo tenant actually has the data" was the single biggest stumble. A short page in the docs — "what data is available in the stage / demo tenant, and for which IMOs" — would have changed my design choices on day one. As-is, I had to discover the shape by probing.
- **The case-conversion contract is one-directional in the docs.** The guide says snake_case → camelCase happens automatically. It does NOT mention that this conversion applies to all top-level data: my data-lake responses use `snake_case`, I defined my OpenAPI schemas in `camelCase`, and I had to manually re-map the snake_case data-lake payload to camelCase output schema in handlers — *which is the right thing*, but the docs read like the platform would do this for me too. Stating clearly "your OpenAPI schemas are the contract; how you produce that payload is your problem" would help.

### Friction (eval harness)

- **Widget steps' input data isn't surfaced via `SandboxToolCallSummary.args`.** The widget-protocol doc says the bridge emits `{ type: "widget", widget, data }` for `show_*` calls. The eval-harness aggregator's `extractSandboxCalls` (in `harness/aggregate.js`) reads `s.input ?? {}` for the `args` field — but widget steps have the payload on `s.data`, not `s.input`. As a result, `result.toolCalls.find(c => c.name === "show_my_widget")!.args` is always `{}` for widget calls. This forced me to drop my widget-args assertions (the ones that check "is the agent passing the IMO it discovered, or did it hallucinate one") and fall back to `toPassLlmJudge` against the response, which is slower, less specific, and statistically less reliable. A two-line fix in `extractSandboxCalls` would unblock structural assertions on the most important thing a display widget can be tested for: the data it received.

### Friction (sandbox typecheck vs. mock fidelity)

- **The sandbox typechecks agent-generated code against the platform's OpenAPI-derived types, but the mocks don't have to match those shapes.** This produces a confusing failure mode: the mock returns the data the agent asked for, but a *subsequent* line accessing a non-existent property fails the typecheck and surfaces as a generic `execute_code: Type errors in your code` error pointing at a downstream line. I hit this twice — once because my mock fixture for `vessel_get_vessel_port_calls` used `portName` (my widget's field name) but the real built-in returns `portId`, and once because my knowledge file told the agent to call `vessel_get_fleet_vessels({ query })` but the real tool only accepts `imo`/`segment`.

  Two things would help: (1) `MockTools.mock` could optionally validate the static value against the loaded tool's output schema and warn on mismatch at mock-definition time, and (2) the type-error message could include the tool name and the expected type, not just "Property X does not exist on type ...".

### Surprises (not necessarily bad)

- **The forwarded `Authorization: Bearer` is the operator's JWT, not an M2M token.** I expected to need M2M creds; the platform actually forwards the operator's session token, and that works for data-lake calls. Good design — operator identity flows all the way through. Worth surfacing in the building-a-tool-server guide explicitly: "your endpoint receives the operator's bearer token; use it as-is to call upstream APIs that trust the same Auth0 tenant."
- **`tsx` watches `.ts` files but needs `allowImportingTsExtensions: true` in tsconfig** if you also want `tsc --noEmit` to typecheck imports with `.ts` extensions (NodeNext + ESM combo). Worth mentioning in any starter scaffold the platform suggests.
