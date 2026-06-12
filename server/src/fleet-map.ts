/**
 * Thin typed client for the ZeroNorth fleet-map AIS service (stage).
 *
 * Endpoint: POST {FLEET_MAP_BASE_URL}/api/ais/v1/latest  body { imos: number[] }
 * Returns the latest AIS position per IMO. Forwards the operator's bearer token
 * unchanged — same pass-through pattern as the data-lake client.
 *
 * The base URL is tenant-scoped (e.g. https://trafigura.stage.zeronorth.app/fleet-map),
 * so override it per tenant via FLEET_MAP_BASE_URL.
 *
 * NOTE: the exact response JSON shape had not been observed when this was written,
 * so `parseLatestPositions` extracts lat/lon defensively across the plausible
 * shapes — a top-level array, `{ data|positions|vessels|results: [...] }`, or an
 * imo-keyed map; with `latitude|lat`, `longitude|lon|lng`, a nested `position`/
 * `location` object, or GeoJSON `coordinates: [lon, lat]`. Once a real response is
 * captured, tighten this to the actual field names.
 */

const FLEET_MAP_BASE_URL =
  process.env.FLEET_MAP_BASE_URL ?? "https://trafigura.stage.zeronorth.app/fleet-map";

// Hard cap on a single upstream call so a slow/unreachable service rejects rather
// than hanging the tool call. Mirrors DATA_LAKE_TIMEOUT_MS.
const FLEET_MAP_TIMEOUT_MS = Number(process.env.FLEET_MAP_TIMEOUT_MS ?? 8000);

class FleetMapError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type AisPosition = { lat: number; lon: number };

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

// Pull lat/lon out of one record across the plausible field namings.
const extractLatLon = (rec: Record<string, unknown>): AisPosition | null => {
  const pos = (
    (typeof rec.position === "object" && rec.position) ||
    (typeof rec.location === "object" && rec.location) ||
    rec
  ) as Record<string, unknown>;
  let lat = num(pos.latitude) ?? num(pos.lat);
  let lon = num(pos.longitude) ?? num(pos.lon) ?? num(pos.lng);
  // GeoJSON-style coordinates: [lon, lat].
  if ((lat === undefined || lon === undefined) && Array.isArray(rec.coordinates)) {
    lon = num(rec.coordinates[0]) ?? lon;
    lat = num(rec.coordinates[1]) ?? lat;
  }
  if (lat === undefined || lon === undefined) return null;
  return { lat, lon };
};

const recordImo = (rec: Record<string, unknown>): number | undefined =>
  num(rec.imo) ?? num(rec.imoNumber) ?? num(rec.imo_number);

const parseLatestPositions = (body: unknown): Map<number, AisPosition> => {
  const out = new Map<number, AisPosition>();
  if (body === null || typeof body !== "object") return out;

  const obj = body as Record<string, unknown>;
  const arr: unknown[] | null =
    (Array.isArray(body) && body) ||
    (Array.isArray(obj.data) && obj.data) ||
    (Array.isArray(obj.positions) && obj.positions) ||
    (Array.isArray(obj.vessels) && obj.vessels) ||
    (Array.isArray(obj.results) && obj.results) ||
    null;

  if (arr) {
    for (const item of arr) {
      if (item === null || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const imo = recordImo(rec);
      const pos = extractLatLon(rec);
      if (imo !== undefined && pos) out.set(imo, pos);
    }
    return out;
  }

  // Otherwise treat it as an imo-keyed map: { "1010108": { lat, lon }, ... }.
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || typeof value !== "object") continue;
    const rec = value as Record<string, unknown>;
    const imo = num(Number(key)) ?? recordImo(rec);
    const pos = extractLatLon(rec);
    if (imo !== undefined && pos) out.set(imo, pos);
  }
  return out;
};

// Latest AIS position per IMO, batched in one call. Resolves to an empty map when
// the body is empty/unparseable; throws FleetMapError on transport/non-2xx so the
// caller can soften it to the offline fallback.
const getLatestAisPositions = async (
  imos: number[],
  auth: string | undefined,
): Promise<Map<number, AisPosition>> => {
  if (imos.length === 0) return new Map();

  const url = FLEET_MAP_BASE_URL + "/api/ais/v1/latest";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (auth) headers.Authorization = auth;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ imos }),
      signal: AbortSignal.timeout(FLEET_MAP_TIMEOUT_MS),
    });
  } catch (e) {
    throw new FleetMapError(504, String(e), "fleet-map AIS latest fetch failed");
  }
  const text = await res.text();
  if (!res.ok) {
    throw new FleetMapError(
      res.status,
      text,
      `fleet-map AIS latest returned ${res.status}: ${text.slice(0, 200)}`,
    );
  }
  return parseLatestPositions(text.length > 0 ? JSON.parse(text) : null);
};

export { FleetMapError, getLatestAisPositions, parseLatestPositions };
export type { AisPosition };
