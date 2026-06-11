/**
 * Handlers for the seven vessel-tinder widget tools. Each gathers real
 * `VesselFacts` for one or more vessels (shared `gatherVesselFacts`) and projects
 * into the widget's input shape. The agent passes each result STRAIGHT to the
 * matching `show_vessel_*` render tool. Always resolves — fact-gathering softens
 * the expected upstream failures and falls back to the demo fixture.
 */

import { gatherVesselFacts, type VesselFacts } from "../vessel-facts.ts";
import {
  projectBiodata,
  projectRoast,
  projectTrafficSignal,
  projectLoveMeter,
  projectMatch,
  projectPooling,
  projectBreakup,
} from "../vessel-projections.ts";

/** A vessel reference from the agent: IMO plus an optional display name. */
type VesselRef = { imo: number; name: string | null };

const factsFor = (ref: VesselRef, year: number, auth: string | undefined): Promise<VesselFacts> =>
  gatherVesselFacts(ref.imo, year, auth, ref.name);

const factsForMany = (refs: VesselRef[], year: number, auth: string | undefined): Promise<VesselFacts[]> =>
  Promise.all(refs.map((r) => factsFor(r, year, auth)));

const handleGetVesselBiodata = async (ref: VesselRef, year: number, auth: string | undefined) =>
  projectBiodata(await factsFor(ref, year, auth));

const handleGetVesselRoast = async (refs: VesselRef[], year: number, auth: string | undefined) =>
  projectRoast(await factsForMany(refs, year, auth));

const handleGetVesselTrafficSignal = async (
  anchorName: string,
  refs: VesselRef[],
  year: number,
  auth: string | undefined,
) => projectTrafficSignal(anchorName, await factsForMany(refs, year, auth));

const handleGetVesselLoveMeter = async (
  a: VesselRef,
  b: VesselRef,
  year: number,
  auth: string | undefined,
) => {
  const [fa, fb] = await Promise.all([factsFor(a, year, auth), factsFor(b, year, auth)]);
  return projectLoveMeter(fa, fb);
};

const handleGetVesselMatch = async (
  anchorName: string,
  refs: VesselRef[],
  year: number,
  auth: string | undefined,
) => projectMatch(anchorName, await factsForMany(refs, year, auth));

const handleGetVesselPooling = async (refs: VesselRef[], year: number, auth: string | undefined) =>
  projectPooling(await factsForMany(refs, year, auth));

const handleGetVesselBreakup = async (
  ex: VesselRef,
  keeper: VesselRef | null,
  rebound: VesselRef | null,
  year: number,
  auth: string | undefined,
) => {
  const [exF, keeperF, reboundF] = await Promise.all([
    factsFor(ex, year, auth),
    keeper ? factsFor(keeper, year, auth) : Promise.resolve(null),
    rebound ? factsFor(rebound, year, auth) : Promise.resolve(null),
  ]);
  return projectBreakup(exF, keeperF, reboundF);
};

export {
  handleGetVesselBiodata,
  handleGetVesselRoast,
  handleGetVesselTrafficSignal,
  handleGetVesselLoveMeter,
  handleGetVesselMatch,
  handleGetVesselPooling,
  handleGetVesselBreakup,
};
export type { VesselRef };
