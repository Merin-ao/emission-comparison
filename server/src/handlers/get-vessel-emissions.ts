import { gatherVesselFacts } from "../vessel-facts.ts";
import { projectEmissions } from "../vessel-projections.ts";
import type { EmissionAnalyticsInput } from "@0north/zap-widgets/schema";

/**
 * The tool response shape IS the emission_analytics widget's input shape — the
 * lockstep contract. Both this handler and the generated OpenAPI `EmissionsResult`
 * (see ../spec.ts) derive from one Zod source of truth. The agent passes this
 * result STRAIGHT to `show_emission_analytics`.
 *
 * All figures now come from the shared `gatherVesselFacts` core (vessel-details +
 * year-to-date-cii + fuel-eu), so DWT, EU ETS exposure, and eligibility are real
 * again (previously null after the vessel-details client was removed), and the
 * CII / FuelEU values are read from the correct nested upstream fields.
 */
type EmissionsResponse = EmissionAnalyticsInput;

const handleGetVesselEmissions = async (
  imo: number,
  year: number,
  authHeader: string | undefined,
  vesselName: string | null = null,
): Promise<EmissionsResponse> => {
  const facts = await gatherVesselFacts(imo, year, authHeader, vesselName);
  return projectEmissions(facts);
};

export { handleGetVesselEmissions };
export type { EmissionsResponse };
