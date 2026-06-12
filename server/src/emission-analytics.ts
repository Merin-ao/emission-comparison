/**
 * Thin typed client for ZeroNorth's emission-analytics-api (stage).
 *
 * Forwards the operator's bearer token, same as `data-lake.ts`. The difference
 * is purely authorization: this API is RBAC-gated. On stage, neither the demo
 * nor trafigura operator token (nor even an M2M token) currently has the
 * emission-analytics role, so every call returns `403 RBAC: access denied`
 * until the platform team grants access. The handler degrades gracefully on
 * 403/404 rather than throwing — see `handlers/get-vessel-emissions.ts`.
 */

const EMISSIONS_BASE_URL =
  process.env.EMISSIONS_BASE_URL ??
  "https://api.private.stage.zeronorth.app/emission-analytics-api";

// Hard cap on a single upstream call. Without it a slow/unreachable upstream
// hangs the fetch forever — and the handlers' try/catch only catches a *rejected*
// fetch, not a hang, so the whole tool call stalls until the ZAP platform times it
// out and the agent reports a "connectivity problem". A bounded timeout turns the
// hang into a normal rejection, which the handlers already degrade to a fixture.
const EMISSIONS_TIMEOUT_MS = Number(process.env.EMISSIONS_TIMEOUT_MS ?? 8000);

class EmissionsError extends Error {
  readonly status: number | "fetch_failed";
  readonly body: string;
  constructor(status: number | "fetch_failed", body: string, message: string) {
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
  const url = new URL(EMISSIONS_BASE_URL + path);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (authHeader) headers.Authorization = authHeader;

  let res: Response;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(EMISSIONS_TIMEOUT_MS) });
  } catch (e) {
    throw new EmissionsError("fetch_failed", String(e), `emission-analytics ${path} fetch failed`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new EmissionsError(
      res.status,
      text,
      `emission-analytics ${path} returned ${res.status}: ${text.slice(0, 200)}`,
    );
  }
  return text.length > 0 ? (JSON.parse(text) as T) : (undefined as T);
};

/** POST variant for the upstream endpoints that take a JSON body (e.g. the batch
 *  /vessel-characteristics). Same token forwarding and error semantics as `request`. */
const requestPost = async <T>(path: string, body: unknown, authHeader: string | undefined): Promise<T> => {
  const url = new URL(EMISSIONS_BASE_URL + path);
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  if (authHeader) headers.Authorization = authHeader;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(EMISSIONS_TIMEOUT_MS),
    });
  } catch (e) {
    throw new EmissionsError("fetch_failed", String(e), `emission-analytics ${path} fetch failed`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new EmissionsError(res.status, text, `emission-analytics ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }
  return text.length > 0 ? (JSON.parse(text) as T) : (undefined as T);
};

// ---------- Upstream shapes (only the fields we project) ----------
//
// Shapes mirror the emission-analytics-api OpenAPI (GET /docs/json). NOTE the
// nested objects: `requiredCii`, FuelEU `complianceBalance`/`penaltyCost` are
// objects upstream, not bare numbers — extract the inner scalar.

/** A CII attained/required reference: the numeric value + its A–E rating band. */
type CiiRef = { cii?: number | null; rating?: string | null; year?: number | null };

type FuelEuDetails = {
  complianceBalance?: { balanceValue?: number | null } | null;
  penaltyCost?: { penaltyValue?: number | null; isPenalty?: boolean | null } | null;
};

type YearToDateCii = {
  rating?: string | null;
  cii?: number | null;
  requiredCii?: CiiRef | null;
  previousYearCiiAndRating?: { attained?: CiiRef | null; required?: CiiRef | null } | null;
};

/** One fuel grade's slice of the vessel's consumption (used to pick the main fuel). */
type FuelWiseConsumption = {
  fuelType?: string | null;
  fuelConsumption?: number | null;
  co2Emission?: number | null;
};

type VesselDetails = {
  imo?: number;
  shipCiiType?: string | null;
  dwt?: number | null;
  iceClass?: string | null;
  referenceCII?: number | null;
  euMrvEligible?: boolean | null;
  ukMrvEligible?: boolean | null;
  fuelEuEligible?: boolean | null;
  euEtsGtEligible?: boolean | null;
  performance?: {
    distanceSailed?: number | null;
    timeUnderway?: number | null;
    averageSpeed?: number | Record<string, unknown> | null;
  } | null;
  vesselEuEtsExposure?: { totalEuaCost?: number | null; totalCo2Emission?: number | null } | null;
  fuelConsumption?: { totalCo2Emission?: number | null; fuelWiseConsumption?: FuelWiseConsumption[] | null } | null;
  aer?: {
    cii?: { attained?: CiiRef | null; required?: CiiRef | null } | null;
    comparison?: { up?: boolean | null; down?: boolean | null; percentage?: number | null } | null;
  } | null;
};

// ---------- Public API ----------

const getFuelEuDetails = (imo: number, year: number, auth: string | undefined) =>
  request<FuelEuDetails>(`/vessel-fuel-eu-details/${imo}`, { year }, auth);

const getYearToDateCii = (imo: number, auth: string | undefined) =>
  request<YearToDateCii>(`/year-to-date-cii/${imo}`, {}, auth);

const getVesselDetails = (imo: number, year: number, auth: string | undefined) =>
  request<VesselDetails>(`/vessel-details/${imo}`, { year }, auth);

/** Static vessel characteristics — the source of `yearOfBuild` (build year/age),
 *  plus capacity / ice class / subtype as a secondary source for those fields.
 *  Batch endpoint: POST a list of IMOs, get one entry per vessel. */
type VesselCharacteristics = {
  imo?: number;
  vesselName?: string | null;
  yearOfBuild?: number | null;
  capacity?: { deadweight?: number | null; grossTonnage?: number | null } | null;
  registration?: { iceClass?: string | null; isIceClassed?: boolean | null } | null;
  vesselTypeAndTrading?: { vesselSubtype?: string | null } | null;
};

const getVesselCharacteristics = (imos: number[], year: number, auth: string | undefined) =>
  requestPost<VesselCharacteristics[]>("/vessel-characteristics", { imos, year }, auth);

/** One voyage row from the voyage-overview dashboard. Only the fields the voyage
 *  swipe deck projects are typed; `departure`/`arrival` carry the route ports and
 *  `voyageLegs[].isEuMrvEligible` drives the derived EU-port-activity share. */
type VoyageOverviewRow = {
  imo?: number | null;
  vesselName?: string | null;
  segment?: string | null;
  attained?: { rating?: string | null } | null;
  departure?: { portName?: string | null } | null;
  arrival?: { portName?: string | null } | null;
  totalDistance?: number | null;
  voyageLegs?: { isEuMrvEligible?: boolean | null }[] | null;
};

type VoyageOverview = { data?: VoyageOverviewRow[] | null; count?: number | null };

/** Voyage-overview dashboard rows (one per voyage). Paginated upstream — `limit`
 *  and `offset` are required; we default to a single page of recent voyages. */
const getVoyageOverview = (
  year: number,
  auth: string | undefined,
  opts: { limit?: number; offset?: number } = {},
) => request<VoyageOverview>("/voyage-overview", { year, limit: opts.limit ?? 20, offset: opts.offset ?? 0 }, auth);

export {
  EmissionsError,
  request,
  getFuelEuDetails,
  getYearToDateCii,
  getVesselDetails,
  getVesselCharacteristics,
  getVoyageOverview,
};
export type { CiiRef, FuelEuDetails, YearToDateCii, VesselDetails, VesselCharacteristics, VoyageOverview, VoyageOverviewRow };
