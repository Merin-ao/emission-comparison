---
title: Emissions & operational data
description: How to use the emissions tools — EU ETS, FuelEU, CII — and the noon report.
mode: ambient
---

## Emissions & compliance

Look up a vessel's emissions and regulatory compliance with
`emissions_get_vessel_emissions` (by IMO, optional year, defaults to 2025).

Key concepts:

- **CII (Carbon Intensity Indicator)**: an annual A–E grade (A is best).
  `ciiAttained` is the vessel's value; `ciiRequired` is the regulatory target
  for the year; `ciiRating` is the letter grade.
- **EU ETS exposure (`euEtsExposure`)**: the vessel's carbon cost under the EU
  Emissions Trading System, in EUR.
- **FuelEU**: `fuelEuComplianceBalance` is the compliance balance in tonnes
  CO2eq (positive = surplus, negative = deficit); `fuelEuPenaltyCost` is the
  penalty in EUR.

Rules:

- Never estimate or guess emissions, EU ETS, FuelEU, or CII values — always
  call `emissions_get_vessel_emissions`.
- To show the figures, pass the tool's result **straight** to
  `show_emission_analytics` — do NOT reshape it; the response is already in the
  widget's shape. Pass `vesselName` to `emissions_get_vessel_emissions` when you
  know it so the card header shows the name instead of the IMO. The card flags
  demo (fixture) and unavailable data visually, but you must still say so in
  text (see the `dataSource` rule below).
- The tool always returns 200. Check `dataSource`:
  - `live` — real figures from emission-analytics; present normally.
  - `fixture` — a demo fallback used because the live API is access-denied or
    empty for this tenant. The figures are populated and safe to show, but you
    MUST tell the user they are demo/illustrative figures (quote `message`),
    not live data.
- If `dataAvailable` is false, no figures and no fixture exist; quote `message`
  and tell the user the data is unavailable. Do not fabricate figures.
- Always use a real IMO from the fleet (`vessel_get_fleet_vessels`); never
  guess an IMO.

## Vessel-tinder widgets (all fact-backed)

These playful widgets are now backed by **real** emission-analytics data — the
same CII / EU ETS / FuelEU figures behind `emissions_get_vessel_emissions`. Do
**not** invent vessel numbers, scores, or savings; always call the matching tool
and pass its result **straight** to the `show_vessel_*` render tool (no
reshaping). All take an optional `year` (defaults 2025) and tolerate the
fixture/unavailable fallback (say "demo fixture data" when figures are demo).

- **`emissions_get_vessel_biodata`** (one `imo`, optional `vesselName`) → matrimonial-style profile (type, DWT, CII now/last, EU ETS, FuelEU, CO₂eq). Pass to `show_vessel_biodata`. This is the **default card for any open-ended ask about a single named vessel** — call it for "biodata of <vessel>", "tell me about <vessel>", "<vessel> details/detail", "<vessel> portfolio" or "portfolio information", "who is <vessel>", "profile <vessel>", "show me <vessel>", and similar. (Use `emissions_get_vessel_emissions` instead only when the user specifically asks for emissions / CII / EU ETS / FuelEU figures.)
- **`emissions_get_vessel_roast`** (`imos` = comma-separated IMOs, optional `names`) → brutal/mild roast deck keyed to each vessel's real CII grade. Pass to `show_vessel_roast`.
- **`emissions_get_vessel_traffic_signal`** (`imos`, optional `names`, `anchorName`) → green/amber/red charter screen from real CII. Pass to `show_vessel_traffic_signal`.
- **`emissions_get_vessel_love_meter`** (`imoA`, `imoB`, optional `nameA`/`nameB`) → 0–100 compatibility from both vessels' real grades. Pass to `show_vessel_love_meter`.
- **`emissions_get_vessel_match`** (`imos`, optional `names`, `anchorName`) → ranked match deck (composite of real CII/ETS/FuelEU; `builtYear`/DWT from `/vessel-characteristics`). Pass to `show_vessel_tinder_match`.
- **`emissions_get_vessel_pooling`** (`imos`, optional `names`) → FuelEU pooling savings; `cut` is directional CO₂-avoidable from each vessel's real annual CO₂eq. Pass to `show_vessel_pooling_meter`.
- **`emissions_get_vessel_breakup`** (`imo` = the "ex"; optional `keeperImo`, `reboundImo`, names) → break-up letter with the ex's real CO₂/ETS as the savings. Pass to `show_vessel_breakup`.

A couple of fields still have no upstream source and read as **n/a** (recent
route, cargo carried) — never fabricate them; present them as not available.
Build year / vessel age now come from `/vessel-characteristics`.

## Operational noon report

`emissions_get_vessel_noon_report` (by IMO) returns the latest noon report from
the data-lake: position, course, speed, distance run in the last 24 h, observed
weather, fuel ROBs, 24 h fuel consumption, and origin/destination ports. Use it
to ground operational facts (where a vessel is, how fast, how much fuel)
instead of guessing.

- If `report` is non-null, use it. If `status` is `no_report`, fall back to AIS
  trail (`vessel_get_vessel_trail` / `vessel_get_vessel_positions`) and say so.
- `dataSource` is `live` (real data-lake) or `fixture` (a demo fallback used in
  tenants with no noon reports). When it is `fixture`, mention "demo fixture
  data" rather than presenting it as live.
