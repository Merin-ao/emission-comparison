/**
 * Thin typed client for the ZeroNorth Data Lake (stage).
 *
 * Forwards the operator's bearer token — the platform attaches `Authorization`
 * to every call to this tool server, and we pass it through unchanged. Same
 * pattern as the reference Captain's Log submission.
 *
 * This is the upstream your operator token CAN reach (verified: a request to
 * `latest-noon-report-pd` returns 200/404, never 403). Contrast with
 * emission-analytics, which is RBAC-gated — see `emission-analytics.ts`.
 */

const DATA_LAKE_BASE_URL =
  process.env.DATA_LAKE_BASE_URL ?? "https://dl.stage.zeronorth.app/data-lake";

// Hard cap on a single upstream call so a slow/unreachable data-lake rejects
// rather than hanging the tool call until the platform times it out. See the
// matching note in emission-analytics.ts.
const DATA_LAKE_TIMEOUT_MS = Number(process.env.DATA_LAKE_TIMEOUT_MS ?? 8000);

class DataLakeError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const request = async <T>(
  path: string,
  query: Record<string, string | number | undefined>,
  authHeader: string | undefined,
): Promise<T> => {
  const url = new URL(DATA_LAKE_BASE_URL + path);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (authHeader) headers.Authorization = authHeader;

  let res: Response;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(DATA_LAKE_TIMEOUT_MS) });
  } catch (e) {
    // Network failure or timeout — surface as a typed 504 so callers see a
    // bounded DataLakeError instead of a raw, unbounded throw.
    throw new DataLakeError(504, String(e), `Data Lake ${path} fetch failed`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new DataLakeError(
      res.status,
      text,
      `Data Lake ${path} returned ${res.status}: ${text.slice(0, 200)}`,
    );
  }
  return text.length > 0 ? (JSON.parse(text) as T) : (undefined as T);
};

// ---------- Domain types (trimmed from the upstream OpenAPI) ----------

type NoonReportPort = {
  unlocode?: string | null;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type NoonReportNavigationalData = {
  latitude?: number | null;
  longitude?: number | null;
  speed_over_ground?: number | null;
  course_over_ground?: number | null;
  distance_run?: number | null;
};

type NoonReportWeatherConditions = {
  wind_speed_kn?: number | null;
  wind_direction_deg?: number | null;
  wave_height_m?: number | null;
  swell_height_m?: number | null;
  beaufort?: number | null;
};

type NoonReportROB = {
  fuel_grade?: string | null;
  rob_tonnes?: number | null;
};

type NoonReportConsumption = {
  fuel_grade?: string | null;
  consumed_tonnes?: number | null;
};

type NoonReportPD = {
  id: string;
  imo: number;
  datetime_gmt: string;
  voyage_nr?: string | null;
  report_type?: string | null;
  origin_port?: NoonReportPort | null;
  destination_port?: NoonReportPort | null;
  navigational_data?: NoonReportNavigationalData | null;
  weather_conditions?: NoonReportWeatherConditions | null;
  robs?: NoonReportROB[];
  consumptions?: NoonReportConsumption[];
};

// ---------- Public API ----------

const getLatestNoonReport = async (
  imo: number,
  auth: string | undefined,
): Promise<NoonReportPD> =>
  request<NoonReportPD>("/canonical/latest-noon-report-pd", { imo }, auth);

export { DataLakeError, getLatestNoonReport };
export type {
  NoonReportPD,
  NoonReportPort,
  NoonReportNavigationalData,
  NoonReportWeatherConditions,
  NoonReportROB,
  NoonReportConsumption,
};
