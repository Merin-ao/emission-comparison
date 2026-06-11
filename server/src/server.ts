import Fastify, { type FastifyReply } from "fastify";

import { DataLakeError } from "./data-lake.ts";
import { EmissionsError } from "./emission-analytics.ts";
import { handleGetVesselEmissions } from "./handlers/get-vessel-emissions.ts";
import { handleGetVesselNoonReport } from "./handlers/get-vessel-noon-report.ts";
import {
  handleGetVesselBiodata,
  handleGetVesselRoast,
  handleGetVesselTrafficSignal,
  handleGetVesselLoveMeter,
  handleGetVesselMatch,
  handleGetVesselPooling,
  handleGetVesselBreakup,
  type VesselRef,
} from "./handlers/get-vessel-widgets.ts";
import { spec } from "./spec.ts";

const PORT = Number(process.env.PORT ?? 9001);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
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

app.get<{ Querystring: { imo?: string } }>("/get_vessel_noon_report", async (req, reply) => {
  const imo = parseImo(req.query.imo);
  if (imo === null) return reply.code(400).send({ error: "`imo` is required (7-digit integer)" });
  const auth = authOf(req.headers);
  logTokenIfDebug(auth, "get_vessel_noon_report");
  app.log.info({ tenant: tenantOf(auth), imo }, "get_vessel_noon_report");
  try {
    return await handleGetVesselNoonReport(imo, auth);
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

app.get<{ Querystring: { imos?: string; names?: string; anchorName?: string; year?: string } }>(
  "/get_vessel_traffic_signal",
  async (req, reply) => {
    const refs = parseRefs(req.query.imos, req.query.names);
    if (refs.length === 0) return reply.code(400).send({ error: "`imos` is required (comma-separated 7-digit IMOs)" });
    const year = parseYear(req.query.year);
    const auth = authOf(req.headers);
    const anchor = req.query.anchorName?.trim() || refs[0].name || `IMO ${refs[0].imo}`;
    app.log.info({ tenant: tenantOf(auth), count: refs.length, year }, "get_vessel_traffic_signal");
    try {
      return await handleGetVesselTrafficSignal(anchor, refs, year, auth);
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

app.get<{ Querystring: { imos?: string; names?: string; anchorName?: string; year?: string } }>(
  "/get_vessel_match",
  async (req, reply) => {
    const refs = parseRefs(req.query.imos, req.query.names);
    if (refs.length === 0) return reply.code(400).send({ error: "`imos` is required (comma-separated 7-digit IMOs)" });
    const year = parseYear(req.query.year);
    const auth = authOf(req.headers);
    const anchor = req.query.anchorName?.trim() || `Match deck (${refs.length} vessels)`;
    app.log.info({ tenant: tenantOf(auth), count: refs.length, year }, "get_vessel_match");
    try {
      return await handleGetVesselMatch(anchor, refs, year, auth);
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

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .then((address) => {
    app.log.info({ address }, "Emissions tool server listening");
  })
  .catch((err) => {
    app.log.error({ err }, "failed to start");
    process.exit(1);
  });
