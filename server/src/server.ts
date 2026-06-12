import Fastify, { type FastifyReply } from "fastify";

import { DataLakeError } from "./data-lake.ts";
import { EmissionsError } from "./emission-analytics.ts";
import { handleGetVesselEmissions } from "./handlers/get-vessel-emissions.ts";
import { handleGetVesselNoonReport } from "./handlers/get-vessel-noon-report.ts";
import {
  handleGetVesselBiodata,
  handleGetVesselFlipCard,
  handleGetVesselRoast,
  handleGetVesselLoveMeter,
  handleGetVesselPooling,
  handleGetVesselBreakup,
  handleGetVesselDivorce,
  handleGetVesselWelcome,
  handleGetVesselTrafficSignal,
  handleGetVesselTinderVoyage,
  handleGetVesselDowry,
  handleGetVesselGhosted,
  handleGetVesselCrossing,
  handleGetVesselAwards,
  handleGetVesselNearby,
  type VesselRef,
} from "./handlers/get-vessel-widgets.ts";
import { spec } from "./spec.ts";

const PORT = Number(process.env.PORT ?? 9001);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
});

// TEMP DIAGNOSTIC (remove): mirror each inbound request to a file so we can see
// exactly which tools the agent hits on a welcome-chip click.
import { appendFileSync } from "node:fs";
app.addHook("onRequest", async (req) => {
  try {
    appendFileSync(
      "/tmp/zap-toolserver-requests.log",
      `${new Date().toISOString()} ${req.method} ${req.url}\n`,
    );
  } catch {
    /* best-effort */
  }
});

// Pass the operator's bearer token through to the upstreams. The ZAP platform
// attaches `Authorization` to every call; we forward it unchanged.
const authOf = (headers: Record<string, string | string[] | undefined>): string | undefined => {
  const raw = headers.authorization;
  if (typeof raw === "string" && raw.length > 0) return raw;
  return undefined;
};

// Decode (NOT verify) the JWT payload to log which tenant the operator token
// carries. We never log the token itself. Purely a dev-visibility aid.
const tenantOf = (auth: string | undefined): string => {
  if (!auth) return "(no token)";
  try {
    const jwt = auth.replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8"));
    return typeof payload.org_name === "string" ? payload.org_name : "(no org_name)";
  } catch {
    return "(undecodable)";
  }
};

// DEBUG ONLY: print the live operator bearer token that the platform forwards on
// a tool request, so it can be replayed by hand (e.g. pasted into Swagger's
// Authorize box). Gated behind DEBUG_LOG_TOKEN=1 so it never fires by default —
// the token is a secret; do not enable in shared/committed runs.
const logTokenIfDebug = (auth: string | undefined, op: string): void => {
  if (process.env.DEBUG_LOG_TOKEN === "1" && auth) {
    // `authorization` = full header (use for `curl -H "Authorization: ..."`).
    // `bearerToken`   = stripped of the "Bearer " prefix (paste into Swagger's
    //                   Authorize box, which prepends "Bearer " itself).
    const bearerToken = auth.replace(/^Bearer\s+/i, "");
    app.log.warn(
      { op, authorization: auth, bearerToken },
      "operator token (DEBUG_LOG_TOKEN) — secret, do not commit/share",
    );
  }
};

const parseImo = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1_000_000 || n > 9_999_999) return null;
  return n;
};

const parseYear = (raw: string | undefined): number => {
  const y = raw ? Number(raw) : 2026;
  return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : 2026;
};

/** Parse comma-separated `imos` + optional aligned `names` into vessel refs,
 *  dropping any invalid IMO. */
const parseRefs = (imos: string | undefined, names: string | undefined): VesselRef[] => {
  if (!imos) return [];
  const nameArr = (names ?? "").split(",").map((s) => s.trim());
  return imos
    .split(",")
    .map((s, i) => {
      const imo = parseImo(s.trim());
      return imo === null ? null : { imo, name: nameArr[i] || null };
    })
    .filter((r): r is VesselRef => r !== null);
};

const mapError = (reply: FastifyReply, err: unknown): unknown => {
  if (err instanceof DataLakeError || err instanceof EmissionsError) {
    app.log.error({ err, status: (err as EmissionsError).status, body: (err as EmissionsError).body }, "upstream error -> 502");
    return reply.code(502).send({ error: err.message });
  }
  if (err instanceof Error) {
    app.log.error({ err }, "handler failed");
    return reply.code(500).send({ error: err.message });
  }
  return reply.code(500).send({ error: "unknown error" });
};

app.get("/openapi.json", async () => spec);

app.get("/health", async () => ({ ok: true }));

app.get<{ Querystring: { imo?: string; year?: string; vesselName?: string } }>(
  "/get_vessel_emissions",
  async (req, reply) => {
    const imo = parseImo(req.query.imo);
    if (imo === null) return reply.code(400).send({ error: "`imo` is required (7-digit integer)" });
    const year = req.query.year ? Number(req.query.year) : 2026;
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return reply.code(400).send({ error: "`year` must be a 4-digit integer" });
    }
    const vesselName = req.query.vesselName?.trim() || null;
    const auth = authOf(req.headers);
    logTokenIfDebug(auth, "get_vessel_emissions");
    app.log.info({ tenant: tenantOf(auth), imo, year }, "get_vessel_emissions");
    try {
      return await handleGetVesselEmissions(imo, year, auth, vesselName);
    } catch (err) {
      return mapError(reply, err);
    }
  },
);

app.get<{ Querystring: { imo?: string; vesselName?: string } }>("/get_vessel_noon_report", async (req, reply) => {
  const imo = parseImo(req.query.imo);
  if (imo === null) return reply.code(400).send({ error: "`imo` is required (7-digit integer)" });
  const auth = authOf(req.headers);
  logTokenIfDebug(auth, "get_vessel_noon_report");
  app.log.info({ tenant: tenantOf(auth), imo }, "get_vessel_noon_report");
  try {
    return await handleGetVesselNoonReport(imo, auth, req.query.vesselName?.trim() || null);
  } catch (err) {
    return mapError(reply, err);
  }
});

app.get<{ Querystring: { imo?: string; year?: string; vesselName?: string } }>(
  "/get_vessel_biodata",
  async (req, reply) => {
    const imo = parseImo(req.query.imo);
    if (imo === null) return reply.code(400).send({ error: "`imo` is required (7-digit integer)" });
    const year = parseYear(req.query.year);
    const auth = authOf(req.headers);
    logTokenIfDebug(auth, "get_vessel_biodata");
    app.log.info({ tenant: tenantOf(auth), imo, year }, "get_vessel_biodata");
    try {
      const result = await handleGetVesselBiodata({ imo, name: req.query.vesselName?.trim() || null }, year, auth);
      // Print the full biodata API response to the terminal on each load.
      console.error(`\n[biodata response] imo=${imo}\n${JSON.stringify(result, null, 2)}\n`);
      return result;
    } catch (err) {
      return mapError(reply, err);
    }
  },
);

app.get<{ Querystring: { imo?: string; year?: string; vesselName?: string } }>(
  "/get_vessel_flip_card",
  async (req, reply) => {
    const imo = parseImo(req.query.imo);
    if (imo === null) return reply.code(400).send({ error: "`imo` is required (7-digit integer)" });
    const year = parseYear(req.query.year);
    const auth = authOf(req.headers);
    logTokenIfDebug(auth, "get_vessel_flip_card");
    app.log.info({ tenant: tenantOf(auth), imo, year }, "get_vessel_flip_card");
    try {
      // Same data as biodata — a flip-card presentation of the same payload.
      return await handleGetVesselFlipCard({ imo, name: req.query.vesselName?.trim() || null }, year, auth);
    } catch (err) {
      return mapError(reply, err);
    }
  },
);

app.get<{ Querystring: { imos?: string; names?: string; year?: string } }>(
  "/get_vessel_roast",
  async (req, reply) => {
    const refs = parseRefs(req.query.imos, req.query.names);
    if (refs.length === 0) return reply.code(400).send({ error: "`imos` is required (comma-separated 7-digit IMOs)" });
    const year = parseYear(req.query.year);
    const auth = authOf(req.headers);
    app.log.info({ tenant: tenantOf(auth), count: refs.length, year }, "get_vessel_roast");
    try {
      return await handleGetVesselRoast(refs, year, auth);
    } catch (err) {
      return mapError(reply, err);
    }
  },
);

app.get<{ Querystring: { imoA?: string; imoB?: string; nameA?: string; nameB?: string; year?: string } }>(
  "/get_vessel_love_meter",
  async (req, reply) => {
    const a = parseImo(req.query.imoA);
    const b = parseImo(req.query.imoB);
    if (a === null || b === null) {
      return reply.code(400).send({ error: "`imoA` and `imoB` are required (7-digit integers)" });
    }
    const year = parseYear(req.query.year);
    const auth = authOf(req.headers);
    app.log.info({ tenant: tenantOf(auth), imoA: a, imoB: b, year }, "get_vessel_love_meter");
    try {
      return await handleGetVesselLoveMeter(
        { imo: a, name: req.query.nameA?.trim() || null },
        { imo: b, name: req.query.nameB?.trim() || null },
        year,
        auth,
      );
    } catch (err) {
      return mapError(reply, err);
    }
  },
);

app.get<{ Querystring: { imos?: string; names?: string; year?: string } }>(
  "/get_vessel_pooling",
  async (req, reply) => {
    const refs = parseRefs(req.query.imos, req.query.names);
    if (refs.length === 0) return reply.code(400).send({ error: "`imos` is required (comma-separated 7-digit IMOs)" });
    const year = parseYear(req.query.year);
    const auth = authOf(req.headers);
    app.log.info({ tenant: tenantOf(auth), count: refs.length, year }, "get_vessel_pooling");
    try {
      return await handleGetVesselPooling(refs, year, auth);
    } catch (err) {
      return mapError(reply, err);
    }
  },
);

app.get<{
  Querystring: {
    imo?: string;
    keeperImo?: string;
    reboundImo?: string;
    exName?: string;
    keeperName?: string;
    reboundName?: string;
    year?: string;
  };
}>("/get_vessel_breakup", async (req, reply) => {
  const ex = parseImo(req.query.imo);
  if (ex === null) return reply.code(400).send({ error: "`imo` is required (7-digit integer)" });
  const keeper = parseImo(req.query.keeperImo);
  const rebound = parseImo(req.query.reboundImo);
  const year = parseYear(req.query.year);
  const auth = authOf(req.headers);
  app.log.info({ tenant: tenantOf(auth), imo: ex, year }, "get_vessel_breakup");
  try {
    return await handleGetVesselBreakup(
      { imo: ex, name: req.query.exName?.trim() || null },
      keeper === null ? null : { imo: keeper, name: req.query.keeperName?.trim() || null },
      rebound === null ? null : { imo: rebound, name: req.query.reboundName?.trim() || null },
      year,
      auth,
    );
  } catch (err) {
    return mapError(reply, err);
  }
});

app.get<{
  Querystring: {
    imo?: string;
    counterpartyImo?: string;
    vesselName?: string;
    counterpartyName?: string;
    year?: string;
  };
}>("/get_vessel_divorce", async (req, reply) => {
  const imo = parseImo(req.query.imo);
  if (imo === null) return reply.code(400).send({ error: "`imo` is required (7-digit integer)" });
  const counterparty = parseImo(req.query.counterpartyImo);
  const year = parseYear(req.query.year);
  const auth = authOf(req.headers);
  logTokenIfDebug(auth, "get_vessel_divorce");
  app.log.info({ tenant: tenantOf(auth), imo, year }, "get_vessel_divorce");
  try {
    return await handleGetVesselDivorce(
      { imo, name: req.query.vesselName?.trim() || null },
      counterparty === null ? null : { imo: counterparty, name: req.query.counterpartyName?.trim() || null },
      year,
      auth,
    );
  } catch (err) {
    return mapError(reply, err);
  }
});

app.get<{ Querystring: { imos?: string; names?: string; year?: string; operatorName?: string } }>(
  "/get_vessel_welcome",
  async (req, reply) => {
    // imos is optional — a bare greeting may arrive before any fleet lookup; the
    // handler falls back to the demo fixture vessels in that case.
    const refs = parseRefs(req.query.imos, req.query.names);
    const year = parseYear(req.query.year);
    const auth = authOf(req.headers);
    app.log.info({ tenant: tenantOf(auth), count: refs.length, year }, "get_vessel_welcome");
    try {
      return await handleGetVesselWelcome(refs, year, auth, req.query.operatorName?.trim() || null);
    } catch (err) {
      return mapError(reply, err);
    }
  },
);

app.get<{ Querystring: { imos?: string; names?: string; year?: string } }>(
  "/get_vessel_dowry",
  async (req, reply) => {
    const refs = parseRefs(req.query.imos, req.query.names);
    if (refs.length === 0) return reply.code(400).send({ error: "`imos` is required (comma-separated 7-digit IMOs)" });
    const year = parseYear(req.query.year);
    const auth = authOf(req.headers);
    app.log.info({ tenant: tenantOf(auth), count: refs.length, year }, "get_vessel_dowry");
    try {
      return await handleGetVesselDowry(refs, year, auth);
    } catch (err) {
      return mapError(reply, err);
    }
  },
);

app.get<{ Querystring: { imos?: string; names?: string } }>("/get_vessel_ghosted", async (req, reply) => {
  const refs = parseRefs(req.query.imos, req.query.names);
  if (refs.length === 0) return reply.code(400).send({ error: "`imos` is required (comma-separated 7-digit IMOs)" });
  const auth = authOf(req.headers);
  app.log.info({ tenant: tenantOf(auth), count: refs.length }, "get_vessel_ghosted");
  try {
    return await handleGetVesselGhosted(refs, auth);
  } catch (err) {
    return mapError(reply, err);
  }
});

app.get<{ Querystring: { anchorName?: string; imos?: string; names?: string; year?: string } }>(
  "/get_vessel_traffic_signal",
  async (req, reply) => {
    // imos optional — falls back to the demo fixture vessels for a populated deck.
    const refs = parseRefs(req.query.imos, req.query.names);
    const anchorName = req.query.anchorName?.trim() || "your fleet";
    const year = parseYear(req.query.year);
    const auth = authOf(req.headers);
    app.log.info({ tenant: tenantOf(auth), count: refs.length, year }, "get_vessel_traffic_signal");
    try {
      return await handleGetVesselTrafficSignal(anchorName, refs, year, auth);
    } catch (err) {
      return mapError(reply, err);
    }
  },
);

// Crossing — side-by-side compare of up to 4 vessels. The FIRST imo is the
// reference the others are scored against.
app.get<{ Querystring: { imos?: string; names?: string; year?: string } }>(
  "/get_vessel_crossing",
  async (req, reply) => {
    const refs = parseRefs(req.query.imos, req.query.names);
    if (refs.length === 0) return reply.code(400).send({ error: "`imos` is required (comma-separated; first = reference)" });
    const year = parseYear(req.query.year);
    const auth = authOf(req.headers);
    app.log.info({ tenant: tenantOf(auth), count: refs.length, year }, "get_vessel_crossing");
    try {
      return await handleGetVesselCrossing(refs, year, auth);
    } catch (err) {
      return mapError(reply, err);
    }
  },
);

// Awards / hall of fame — real per-vessel figures; the agent composes the awards.
app.get<{ Querystring: { imos?: string; names?: string; year?: string } }>(
  "/get_vessel_awards",
  async (req, reply) => {
    const refs = parseRefs(req.query.imos, req.query.names);
    if (refs.length === 0) return reply.code(400).send({ error: "`imos` is required (comma-separated 7-digit IMOs)" });
    const year = parseYear(req.query.year);
    const auth = authOf(req.headers);
    app.log.info({ tenant: tenantOf(auth), count: refs.length, year }, "get_vessel_awards");
    try {
      return await handleGetVesselAwards(refs, year, auth);
    } catch (err) {
      return mapError(reply, err);
    }
  },
);

// Nearby radar — each vessel's latest AIS position (data-lake noon report) + CII.
// `anchorName` is the scope centre vessel's name.
app.get<{ Querystring: { imos?: string; names?: string; year?: string; anchorName?: string } }>(
  "/get_vessel_nearby",
  async (req, reply) => {
    const refs = parseRefs(req.query.imos, req.query.names);
    if (refs.length === 0) return reply.code(400).send({ error: "`imos` is required (comma-separated 7-digit IMOs)" });
    const anchorName = req.query.anchorName?.trim() || refs[0]?.name || "reference vessel";
    const year = parseYear(req.query.year);
    const auth = authOf(req.headers);
    app.log.info({ tenant: tenantOf(auth), count: refs.length, year }, "get_vessel_nearby");
    try {
      return await handleGetVesselNearby(anchorName, refs, year, auth);
    } catch (err) {
      return mapError(reply, err);
    }
  },
);

app.get<{ Querystring: { imo?: string; year?: string } }>(
  "/get_vessel_tinder_voyage",
  async (req, reply) => {
    // imo is the optional anchor (the user's own vessel); candidates come from the
    // voyage-overview dashboard. Falls back to a demo deck when unavailable.
    const anchorImo = parseImo(req.query.imo);
    const year = parseYear(req.query.year);
    const auth = authOf(req.headers);
    app.log.info({ tenant: tenantOf(auth), anchorImo, year }, "get_vessel_tinder_voyage");
    try {
      return await handleGetVesselTinderVoyage(anchorImo, year, auth);
    } catch (err) {
      return mapError(reply, err);
    }
  },
);

// Map a clicked-chip prompt to the exact next tool the agent must call. The chip
// labels are stable; we match on the distinctive phrase each prompt carries (flip
// card / love meter prompts also embed a vessel name, hence substring matching).
// Returning the tool name explicitly removes the agent's guesswork — it no longer
// has to re-derive routing from a prose table, which is what left clicks stuck at
// "Opening …" with no widget rendered.
const TOOL_BY_PROMPT: ReadonlyArray<{ match: RegExp; tool: string; render: string }> = [
  { match: /swipe|vessel matches/i, tool: "emissions_get_vessel_traffic_signal", render: "show_vessel_traffic_signal" },
  { match: /voyage/i, tool: "emissions_get_vessel_tinder_voyage", render: "show_vessel_tinder_voyage" },
  { match: /flip card/i, tool: "emissions_get_vessel_flip_card", render: "show_vessel_flip_card" },
  { match: /love meter/i, tool: "emissions_get_vessel_love_meter", render: "show_vessel_love_meter" },
];

const routeForPrompt = (prompt: string): { tool: string; render: string } | null =>
  TOOL_BY_PROMPT.find((r) => r.match.test(prompt)) ?? null;

// Gated by the vessel_welcome approval widget (x-zap-approval-widget). The agent
// provides the welcome data (widget input); the platform renders the interactive
// card; when the user clicks a chip the widget submits { prompt } and the platform
// calls this endpoint with it. We resolve the prompt to the exact next tool and
// return it so the agent calls that tool (then its show_ render tool) without
// having to interpret a routing table.
app.post<{ Body: { prompt?: string } }>("/present_welcome", async (req, reply) => {
  const prompt = (req.body?.prompt ?? "").trim();
  if (!prompt) return reply.code(400).send({ error: "`prompt` is required" });
  const route = routeForPrompt(prompt);
  app.log.info({ prompt, route }, "present_welcome");
  return {
    prompt,
    nextTool: route?.tool ?? null,
    renderTool: route?.render ?? null,
  };
});

// `tsx watch` restarts this process on every save, and the new child often starts
// before the old one has released port 9001 — a brief EADDRINUSE race. With a bare
// `process.exit(1)` that race left the watcher dead and the port unserved, so the
// ZAP platform couldn't reach the tool and the agent reported "connectivity issues".
// Retry the bind a few times so a reload reliably reclaims the port instead of
// crashing; only a genuinely stuck port (or a non-EADDRINUSE error) is fatal.
const LISTEN_RETRIES = 5;
const LISTEN_RETRY_MS = 300;

const start = async (attempt = 1): Promise<void> => {
  try {
    const address = await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info({ address }, "Emissions tool server listening");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "EADDRINUSE" && attempt <= LISTEN_RETRIES) {
      app.log.warn({ attempt, port: PORT }, `port ${PORT} in use, retrying in ${LISTEN_RETRY_MS}ms`);
      await new Promise((resolve) => setTimeout(resolve, LISTEN_RETRY_MS));
      return start(attempt + 1);
    }
    app.log.error({ err }, "failed to start");
    process.exit(1);
  }
};

start();
