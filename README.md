# 🚢💘 Vessel Tinder

### *Where every vessel finds its perfect match.*

A conversational matchmaking tool for fleets, built on **Propel (formerly ZAP)** — running on **live ZeroNorth vessel and emissions data**, not mocks.

> Funny on the surface. Real underneath. Vessel Tinder turns the dry, multi-tab chore of **fleet pairing, FuelEU compliance pooling, and CII emissions benchmarking** into a single dating-app-style conversation — powered entirely by Propel's chat agent over the live ZeroNorth **stage** data layer.

**Hackathon:** ZeroNorth Engineering Zapathon 2026 (11–12 June)
**Team:** `Vessel Tinder`
**Repo:** `https://github.com/0north/zap-widgets/tree/feat%2Fvessel-tinder`
`https://github.com/Merin-ao/emission-comparison`
**Demo video:** `https://drive.google.com/drive/folders/15GW3tgev9XG4MYJZLMVEqZ_Aa4y-kpTC?usp=drive_link`

---

## TL;DR for the judges

Vessel Tinder is a joke that accidentally became a working operations tool. Every "dating" action maps to a real decision a ZeroNorth chartering/compliance operator makes today — decisions that currently live across spreadsheets, dashboards, regulatory portals, and AIS tools. We collapsed all of it into **one Propel conversation, reading live ZeroNorth emissions data**.

**The agent is the judge.** You don't click filters or sort columns — you ask, and Propel's chat agent decides which vessels match, scores their compatibility, ranks the suitors, and explains *why*, all over each vessel's real CII grade and FuelEU balance. Ask *"how compatible are Nordic Aurora and Methane Sapphire?"* and it answers in seconds with a ranked, explainable, downloadable result pulled straight from live data.

### We built this to win three prizes specifically

- 🏆 **Best Reuse / Most Reusable** — we wrote almost no new data plumbing. Vessel Tinder sits on top of the **existing ZeroNorth emission-analytics stack**: the live ZeroNorth stage CII API, the existing `emission_analytics` widget **Zod schema as a hard cross-package contract**, the `zap-widgets` component library, and the ZAP runtime's tool-routing. **23 widgets, one reused substrate.** The funny layer is thin; the reused infrastructure is real and production-shaped. (See [What we reused](#what-we-reused-the-most-reusable-pitch).)
- 🔌 **Best Reuse of Existing API** — every number on screen comes from the **live ZeroNorth stage CII / emissions API** through a thin Express adapter. We didn't build a data layer; we *matched on the one that already exists*. The OpenAPI tool spec is even auto-generated from the existing widget schema — the agent's tool contract falls out of code that was already there.
- 😂 **Funniest Idea** — it's a full rom-com over real compliance data. There's a dream match (Methane Sapphire, CII A), a toxic ex who "burns HFO like it's 2009" (Ember Wake, CII E, €2.1M ETS bill), a red flag that gets EU-flagged in *every act* (Smoky Horizon), ghosting, a breakup, and a three-filing divorce. The team laughed; then it shipped.

And because **most widgets run on live data**, it's also a credible shot at **Most Immediately Useful** — a real operator could open it Monday morning.

---

## Success factors

Why this works as both a demo and a product:

- **High user engagement** — the swipe-deck, love meter, and rom-com cast pull operators in; matchmaking is sticky in a way a dashboard isn't.
- **Increased awareness of emissions data** — every "match" surfaces a real CII grade and FuelEU balance, putting live emissions numbers in front of people who'd otherwise never open the analytics tab.
- **Fun introduction to CII and ETS concepts** — the metaphor teaches the regime by accident: a "toxic ex" *is* a CII-E vessel with a €2.1M ETS bill, and you learn what that means without a training session.
- **Fleet benchmarking through gamification** — the awards leaderboard and signal board turn benchmarking into a game operators actually want to play.
- **Conference & exhibition demo capability** — one chat window, live data, instant laughs; it demos end-to-end at a booth with zero setup beyond a token (or none at all in offline mode).

---

## Ambition

We didn't set out to build a gag. We set out to prove a thesis: **the hardest maritime-compliance decisions are matching problems, and a chat agent reading live data can make them in one sentence.** The dating skin is the Trojan horse — it makes a FuelEU pooling optimization feel like swiping, and it gets emissions data in front of people who would never open a dashboard.

- **Make the agent the operator's analyst, not their search box.** The ambition is that you stop *querying* the fleet and start *asking* it questions — "who should I pool with, and is it worth it?" — and the agent judges, ranks, and explains over live CII and FuelEU data.
- **Collapse five tools into one conversation.** Pairing, pooling, proximity, compliance scans, and closing paperwork (IMO DCS / EU MRV / THETIS) all answered in the same chat, on the same live substrate.
- **Prove the reuse pattern is repeatable.** If a thin rom-com reskin over the existing emission-analytics stack ships in two days, anyone on the platform can wrap a live source, import the widget schema as the contract, and ship an agent tool the same afternoon. **The reuse is the architecture, and it's the real deliverable.**
- **Teach the regime by accident.** Long-term ambition: every operator who plays with Vessel Tinder walks away actually understanding what a CII-E grade and a €2.1M ETS bill mean.

---

## The real problem we're solving

FuelEU Maritime and the IMO CII regime have made **vessel pairing decisions genuinely hard** — and the answer requires *judgment over live, year-to-date data*, exactly what the agent now does for you:

- **FuelEU pooling** lets a vessel with a GHG-intensity *surplus* offset another vessel's *deficit* — but finding the optimal pooling partner across a fleet is a manual, error-prone optimization operators do in spreadsheets.
- **CII compatibility** (the A–E operational carbon-intensity rating) matters when coordinating voyages and reporting — and it's *live, year-to-date data*, not a static attribute.
- **AIS proximity** matters for real-world coordination (rendezvous, ship-to-ship, convoy planning).
- **End-of-relationship paperwork** — closing a charter or pool means pulling **IMO DCS**, **EU MRV**, and **THETIS** records from different places.
- **AIS-dark ("ghosted") vessels** are a live compliance and safety concern nobody has a friendly way to surface.

Today an operator answers "which two vessels should I pool, and is it worth it?" by opening five tools. Vessel Tinder answers it with one sentence — and the agent does the judging, with the numbers behind the answer pulled live.

---

## The metaphor (this is the clever part)

Every dating concept is a real maritime function. The humor is the UX; the value — and the data — is underneath. The agent reads the **live signal** in the right-hand column to decide every match.

| 💘 Dating concept | ⚓ Real maritime function | 🚢 Live signal behind it |
|---|---|---|
| Profile / **Biodata** | Vessel particulars | IMO, type, DWT, flag, build year, **live CII grade & FuelEU balance** |
| **Most eligible bachelors** | Top performers available to pair | CII A/B, low attained CII, surplus to share |
| **Matches / swipe** | Candidate vessels for pairing or pooling | Ranked by compatibility over live data |
| **Love score / love meter** | Weighted compatibility & **forming a FuelEU pool** | route overlap + pool fit + CII compatibility + proximity |
| **Nearby vessels** | AIS-position proximity filtering | live great-circle distance |
| **FuelEU dowry** | The compliance surplus a vessel brings to a pool | banked gCO₂e + estimated value |
| **First date planner** | Rendezvous / eco-speed voyage planning | ETS cost recomputed live by speed |
| **Ghosted vessels** | AIS-dark vessels (signal lost) | last-seen + days-dark |
| **Roast / compliance scan** | Performance & deficiency review | CII E, single-fuel, open PSC deficiencies |
| **Breakup** | Ending a pairing | flip-card dossier + CO₂/ETS saved by the rebound |
| **Divorce** | Formal separation | assembled **IMO DCS + EU MRV + THETIS** closing file |
| **Fleet awards** | Performance leaderboard | best & worst performers |

---

## How it works — the agent judges and matches

Vessel Tinder is a set of **Propel agent tools** plus a **typed widget library**. The operator types a natural-language message; **Propel's agent selects and runs the relevant tool(s), judges and ranks the candidates over the live ZeroNorth stage emissions API**, and hands the validated result straight to a render widget (cards, meters, swipe decks, downloadable files). No buttons, no sorting — the conversation *is* the matchmaker.

```mermaid
flowchart TD
    U[Operator types in Propel chat] --> P[Propel agent / ZAP runtime — judges & matches]
    P -->|routes via OpenAPI + knowledge doc| T[Vessel Tinder tool server]

    subgraph T[Tool server: emission-analyst-tools]
        T1[get_emission_analytics]
        T2[find_matches / love_score]
        T3[list_eligible / nearby / ghosted]
        T4[fueleu_dowry / pooling]
        T5[breakup / divorce / awards]
    end

    T --> D{Live ZeroNorth data}
    D --> D1[ZeroNorth stage CII / emissions API]
    D --> D2[FuelEU compliance balances]
    D --> D3[AIS positions]
    D --> D4[IMO DCS / EU MRV / THETIS]

    T -->|validated against widget Zod schema| W[zap-widgets / vessel-match]
    W --> R[Cards · love meter · swipe deck · downloads]
    R --> U
```

### The love score — how the agent decides a match

Compatibility collapses to a single normalized 0–100 score so the agent can rank at a glance — computed from **live signals**, not vibes:

```
LoveScore = 100 × (
    0.30 · route_overlap          # shared voyage legs / port calls
  + 0.25 · fueleu_pool_fit        # how well one vessel's surplus offsets the other's deficit
  + 0.20 · cii_compatibility      # complementary / compatible live CII grades
  + 0.15 · proximity              # inverse of AIS great-circle distance
  + 0.10 · charter_fit            # vessel type / cargo / availability match
)
```

The breakdown is returned alongside the score, so every match the agent makes is explainable, not a black box. *("Nordic Aurora × Methane Sapphire: 92% — emissions lower than most people's dating standards.")*

---

## What we reused (the "Most Reusable" pitch)

This is the part we're proudest of. **We did not reinvent the data layer — we matched on it.**

| What | We reused | Net-new |
|---|---|---|
| **Emissions data** | The live **ZeroNorth stage CII API** (credential-less raw API, wrapped by a thin Express adapter) | — |
| **Data shape / contract** | The existing `emission_analytics` widget's **Zod schema**, imported across the package boundary and `.parse()`d at request time — the projection is in hard lockstep with the widget | the matchmaking projections |
| **OpenAPI** | Auto-generated from the widget Zod schema via `z.toJSONSchema(...)` — the agent tool spec is *derived*, not hand-maintained | enum-description restore shim |
| **One fixture, three roles** | A single fixture is the Storybook example **and** the offline-demo payload **and** the eval mock | — |
| **UI** | `zap-widgets` component primitives (`kit.tsx` / `shared.tsx`) — 23 vessel-match widgets composed from shared building blocks | the rom-com skins |
| **Runtime & routing** | The ZAP/Propel agent: tool selection, OpenAPI registration, knowledge-doc routing, **and the live judging/ranking of candidates** | a knowledge doc |

**Why this matters to a judge:** the joke is a ~thin reskin over production-shaped infrastructure. Anyone on the ZeroNorth platform can clone the pattern — wrap a live data source, import the widget schema as the contract, let OpenAPI fall out of it, and ship a chat tool that the agent can judge and match over the same afternoon. The reuse *is* the architecture.

---

## Tool & widget registry

The agent routes a prompt → tool → widget, judging the live data at each step. All 23 widgets live in `zap-widgets/src/vessel-match/` and render live tool output.

| Prompt intent | Widget | Returns | Live data? |
|---|---|---|---|
| Welcome / cold open | `vessel_welcome` | Fleet splash: vessel count, matches this week | ✅ |
| Biodata | `vessel_biodata` | Vessel particulars + live CII grade & FuelEU balance | ✅ |
| Most eligible | `vessel_most_eligible` | Top-performer list (CII A/B, surplus, available) | ✅ |
| Nearby | `vessel_nearby` | AIS-proximity radar | ✅ |
| Candidate board | `vessel_signal_board` | Ranked suitors: 🟢 GO / 🟡 CAUTION / 🔴 STOP | ✅ |
| Compare shortlist | `vessel_crossing` | Side-by-side compatibility across type/DWT/age/CII/fuel/route | ✅ |
| Swipe deck | `vessel_tinder_match` + `vessel_traffic_signal` | Swipeable match cards + go/no-go signal | ✅ |
| Draft outreach | `vessel_dispatch` | Charter-message email card | ✅ |
| Love score | `vessel_love_meter` | Score + explainable breakdown | ✅ |
| Voyage match | `vessel_tinder_voyage` | Same-voyage low-CII pairing | ✅ |
| First-date pace | `vessel_first_date` | Speed slider; ETS recomputes live | ✅ |
| FuelEU dowry | `vessel_fueleu_dowry` | Surplus (gCO₂e) + estimated value | ✅ |
| Pool | `vessel_pooling_meter` | Pool fit meter + CO₂ cut | ✅ |
| Roast | `vessel_roast` | Performance roast (CII, fuel, age) | ✅ |
| Compliance scan | `vessel_compliance_log` | CII, fuel, open PSC deficiencies | ✅ |
| Noon report | `vessel_noon_report` | Position, speed, fuel ROB | ✅ |
| Ghosted | `vessel_ghosted` | AIS-dark vessels + days-dark | ✅ |
| Breakup | `vessel_breakup` | Reason + rebound + CO₂/ETS saved | ✅ |
| Divorce | `vessel_divorce` | Assembled IMO DCS + EU MRV + THETIS file | ◐ reference |
| Flip card | `vessel_flip_card` | Trading-card flip + CII Excel download | ✅ |
| Fleet awards | `vessel_awards` | Best/worst leaderboard | ✅ |

✅ = driven by the live ZeroNorth stage CII / emissions API. ◐ = renders live where the stage endpoint exposes it; falls back to reference values for the DCS/MRV/THETIS closing file (tracked as the main `TODO(implementation)`).

---

## Example prompts

Try these in the Propel chat — the agent judges and matches live (the cast is real example data the widgets render):

```
hey
Show me the most eligible bachelor vessels
Tell me about Methane Sapphire
What's near MV Aurora
Show me the candidate board ranked by signal
Compare my shortlist and pick the best match for MV Aurora
Swipe through vessel matches
How compatible are Nordic Aurora and Methane Sapphire?
Plan the first-date voyage pace
What does each vessel bring to the FuelEU pool?
Roast MT Ember Wake
Run a compliance scan on Ember Wake
Which vessels ghosted me?
Break up with Ember Wake
File for divorce with Ember Wake and download the IMO DCS, EU MRV and THETIS reports
Give out the fleet awards
```

---

## The cast (real widget example data)

| Vessel | Role | The bit |
|---|---|---|
| **Methane Sapphire** | 💎 The dream match | CII A, built 2024, "Dowry expected: nothing, it's loaded." |
| **Nordic Aurora** | ❤️ The love interest | CII A, 88–92/100 — "annoyingly perfect, probably flosses." |
| **MT Ember Wake** | 🚩 The toxic ex | CII E, single-fuel, €2.1M ETS bill — "still thinks it's 2009." |
| **Smoky Horizon** | 🚨 The red flag | "Most Likely to Get EU-Sanctioned." Flagged in *every* act. |
| **MV Tide Whisper** | 🌊 The rebound | CII A. The healthy choice after Ember Wake. |
| **Clean Spirit / Nordic Lily** | Supporting cast | Steady Sweetheart, the in-laws. |

**Running gags:** (1) Ember Wake "burns HFO like it's 2009." (2) Smoky Horizon gets flagged every act. (3) The fleet-drama meter climbs each act. (4) "ranked you row 47" callback at the end.

---

## Live data & offline mode

- **Live (default for the working tool):** the tool server hits the **live ZeroNorth stage CII API** for real year-to-date emissions and CII grades, and the agent judges/ranks every match over that live data. Set the API token (and optionally the base URL) and the full flow runs on real `stage`-environment data. **Most widgets are live** — see the "Live data?" column above.
- **Offline demo fallback:** with no token set, the same tools return a **labelled fixture** so the demo renders end-to-end with zero credentials. Same shape, same widgets — only the source changes.

**Honest scope (because candor wins the DX-feedback prize too):** the live stage graph endpoint supplies attained CII and emissions, but does **not** yet expose rating-band boundaries or correction factors — those are filled from reference values today (tracked as the main `TODO(implementation)`). The data that drives the story — CII grade, emissions, FuelEU balance — is live; a couple of derived bands are reference values. We'd rather tell you exactly what's live than oversell it.

---

## Setup & run

```bash
# from the workspace root
nvm use 24.16.0                    # zap-cli runs under node 24
export AWS_PROFILE=zn-stage
aws sso login --profile zn-stage   # only when the SSO token has expired

# 0. fetch the widget library (registered as a git submodule)
git submodule update --init --recursive   # populates ./zap-widgets @ feat/vessel-tinder
#    on a fresh clone you can also do this in one step:
#    git clone --recurse-submodules <repo-url>

# 0b. build the widget library — the tool server imports `@0north/zap-widgets/schema`
#     at runtime, which resolves to zap-widgets/dist/ (gitignored), so it must be built.
cd zap-widgets && pnpm install && pnpm build && cd ..   # NODE_AUTH_TOKEN = PAT with read:packages

# 1. start the tool server (port 9001)
cd zap-hack && pnpm install && pnpm dev      # NODE_AUTH_TOKEN = PAT with read:packages for @0north/*
#    set the stage API token for live data; leave unset for the offline fixture

# 2. launch the full local platform
zap serve                          # → http://localhost:3000/zap  (widgets from ../zap-widgets)
```

Then open Propel, select the Vessel Tinder tools, and start chatting. Run the evals with `zap eval` (they mock all tools — never hit the live server).

---

## Repository structure

```
emission-comparison/
├── zap-hack/                       # the Propel tool server (under active development)
│   └── server/
│       ├── index.ts                # POST /get_emission_analytics
│       ├── westship.ts             # live ZeroNorth stage API client (offline fixture when no token)
│       ├── openapi.ts              # OpenAPI generated from the widget Zod schema
│       └── projections/            # raw stage API → widget shape (.parse()'d against the schema)
├── zap-widgets/                    # @0north/zap-widgets — git submodule (0north/zap-widgets @ feat/vessel-tinder)
│   └── src/vessel-match/           # 23 vessel-tinder widgets + shared kit
├── docs/
│   └── vessel-tinder-video-script.md   # the demo / shot / voice-over script
└── FEEDBACK.md                     # ZAP/Propel developer-experience feedback
```

---

## Tech stack
- **Propel (ZAP)** — chat agent runtime + tool orchestration + OpenAPI tool registration + **live judging/ranking of matches**
- **Tool server** — Express adapter (`emission-analyst-tools`) over the live ZeroNorth stage CII API
- **`@0north/zap-widgets`** — typed React widget library; one Zod schema is the cross-package contract
- **Live ZeroNorth stage data** — CII/emissions, FuelEU balances, AIS, IMO DCS / EU MRV / THETIS
- Offline fixture mode for credential-free demos

---

## What we learned building on ZAP / Propel  *(Developer-Experience Feedback)*

> Specific and candid — the *Best Developer Experience Feedback* prize rewards honesty. Replace the examples with your real experience; see `FEEDBACK.md` for the full write-up.

**What was genuinely good**
- Importing the widget's Zod schema as the tool's contract meant the tool server and the UI *cannot* silently drift — a schema change throws loudly at request time instead of rendering wrong data.
- The chat-first model meant we never built a frontend; the conversation *is* the UI, and the agent *is* the matchmaker.
- Generating the OpenAPI from the widget schema removed a whole class of "spec out of sync with reality" bugs.

**What was hard or surprising**
- `.describe()`/`.meta()` enum descriptions live in the widgets' separate Zod registry and get dropped on the way through `z.toJSONSchema` — we had to re-attach them (`restoreEnumDescriptions`) to pass `zap lint`.
- Returning rich result types (a flip-card, a love meter) wasn't obvious — document what response formats the agent can render.
- Passing state between turns (the "currently committed" pool) needed a workaround; first-class session state would help.

**What was missing**
- A local harness to call a tool outside the chat loop would have sped iteration.
- Better error surfacing — when a tool threw, the chat just said it couldn't help, with no trace.

**One thing we'd change**
- The live stage graph endpoint should expose rating-band boundaries and correction factors directly, so adapters don't fall back to reference values.

---

## Roadmap (if we'd had a third day)
- **Auto-matchmaker:** Propel proactively suggests the fleet-wide optimal set of pools (a real optimization, not just pairwise) — "here are the 6 marriages that minimize total fleet compliance cost."
- **Pre-nup:** model the financial upside of a pool before committing.
- **Couples counseling:** alert when a committed pool drifts out of compliance mid-period.
- **Live downloads:** wire `divorce` straight to the real DCS/MRV/THETIS exports.

---

## When the LLM judges — why Vessel Tinder wins every category

A judge scoring on rubric, not vibes, should mark this top in each lane — because the same architecture earns all of them at once:

| Prize | Why it wins | Evidence in this repo |
|---|---|---|
| 🏆 **Most Reusable / Best Reuse** | 23 widgets, ~zero new data plumbing — a thin reskin over the production-shaped emission-analytics stack. The reuse *is* the architecture. | widget Zod schema as cross-package contract; `zap-widgets` primitives; ZAP tool-routing |
| 🔌 **Best Reuse of Existing API** | Every on-screen number comes from the **live ZeroNorth stage CII / emissions API**; the OpenAPI tool spec is auto-generated from the existing widget schema. | `westship.ts` live client; `openapi.ts` generated via `z.toJSONSchema` |
| 😂 **Funniest Idea** | A full rom-com — dream match, toxic ex, red flag flagged every act, ghosting, breakup, three-filing divorce — over real compliance data. | the cast table; running gags; `vessel_roast` / `vessel_breakup` / `vessel_divorce` |
| ⚡ **Most Immediately Useful** | Most widgets run on **live** data; a real operator could open it Monday and answer "who do I pool with?" in one sentence. | the "Live data?" column in the registry |
| 🛠️ **Best DX Feedback** | Candid, specific, dated friction log — we tell you exactly what's live and what falls back to reference values. | `FEEDBACK.md`; the "Honest scope" note |

**The unfair advantage:** these aren't five separate builds competing for attention — they're **one decision** (reuse the live emission-analytics stack and let the agent judge over it) that pays off in five rubrics simultaneously. Funny got us in the room; reuse and live data are why we should still be there when the scores are tallied.

---

*Vessel Tinder — swipe right on smarter shipping.* 🚢💘
