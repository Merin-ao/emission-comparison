export default {
  environment: "stage", // only stage is supported right now
  env: {
    // This team's LLM key (matches the repo name). Normally resolved from SSM at
    // startup. For a local demo you can run `zap serve --no-ssm` (so the auth0
    // params stay unresolved and the chat WS accepts the dev token) while still
    // injecting the *real* LLM key here via ZAP_LLM_KEY — otherwise `--no-ssm`
    // would leave this as the literal "SSM:…" string and LiteLLM 401s.
    LLM_API_KEY: process.env.ZAP_LLM_KEY ?? "SSM:/stage/zndp-litellm/keys/zapathon-emission-comparison",
    TENANT: "trafigura", // tenant you log into; "demo" is the platform default
  },
  widgets: "./zap-widgets",
  eval: {
    // Discover the domain's eval suites (otherwise vitest falls back to its
    // default **/*.{test,spec} glob and finds none of the *.eval.ts files).
    include: ["zap/evals/**/*.eval.?(c|m)[jt]s?(x)"],
  },
  sources: {
    localDomains: [
      // emissions tool server (server/, Fastify+TS) — run `cd server && PORT=9001 npm start`
      // (or `make tools`). Domain metadata/knowledge/evals live in ./zap.
      { path: "./zap", openApiUrl: "http://localhost:9001/openapi.json" },
    ],
  },
};
