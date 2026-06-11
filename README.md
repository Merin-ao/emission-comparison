# emission-comparison

A workspace for building on **ZAP** (ZeroNorth's agent-tool platform). Local platform runs
via `zap serve`; widgets live in [`zap-widgets/`](./zap-widgets).

## Reference run

Inspired by the [zapathon-claude](https://github.com/0north/zapathon-claude) reference run —
one team's full pass through the ZAP build loop (tool server → widget → eval), warts and all.
Good to crib from when you hit a wall on:

- 🛠️ scaffolding a tool server → `server/`
- 🎨 wiring a widget into zap-widgets → `widgets/src/captains_log/`
- 🧪 getting `zap eval` to behave → `zap/evals/`

## DX feedback

[**FEEDBACK.md**](./FEEDBACK.md) — a dated log of friction points, surprises, and "huh, nice"
moments hit while building on ZAP. Specific by design; meant for the ZAP core team to figure
out what to sharpen next.

## Running the platform locally

```bash
cd /Users/merin.thomas/Downloads/emission-comparison
nvm use 24.16.0            # zap-cli is installed under node 24
export AWS_PROFILE=zn-stage
aws sso login --profile zn-stage   # only when the SSO token has expired
zap serve                  # → http://localhost:3000/zap
```

Run the sample eval with `zap eval` (same first three lines).

Config: [`zap.config.mjs`](./zap.config.mjs) (`environment: "stage"`, `widgets: "./zap-widgets"`).
