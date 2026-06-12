export default {
  environment: "stage", // only stage is supported right now
  env: {
    // This team's LLM key (matches the repo name). Resolved from SSM at startup.
    LLM_API_KEY: "SSM:/stage/zndp-litellm/keys/zapathon-emission-comparison",
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
