import { describe, it, expect } from "vitest";
import { createThread, MockTools, mock } from "@0north/zap-eval-harness";

// The welcome card's vessel-specific chips bind real fleet vessels into their
// prompt (see welcomeSuggestions in server/src/vessel-projections.ts), e.g.
// "Show me a flip card for Methane Sapphire (IMO 9710022)". This eval pins that
// the agent parses the embedded IMO and drives straight to the matching tool —
// rather than dead-ending on a "which vessel?" question, the bug these prompts
// fix. We send the bound prompts as the user (a clicked chip returns the same
// string) and assert the routed tool was actually called.
const FLEET = [
  { imo: "9710022", name: "Methane Sapphire", type: "LNG carrier" },
  { imo: "9920760", name: "Black Falcon", type: "Crude oil tanker" },
];

const baseline = new MockTools()
  .mock("emissions_get_vessel_divorce", mock.static({}))
  .mock("emissions_get_vessel_breakup", mock.static({}))
  .mock("emissions_get_vessel_flip_card", mock.static({}))
  .mock("emissions_get_vessel_love_meter", mock.static({}))
  .mock("vessel_get_fleet_vessels", mock.static(FLEET));

// label → [bound chip prompt, the tool it must reach]
const BOUND_CHIPS: Array<[string, string, string]> = [
  ["Get reports", "Download the IMO DCS and MRV reports for Methane Sapphire (IMO 9710022)", "emissions_get_vessel_divorce"],
  ["Recent breakup", "Show me a recent breakup for Black Falcon (IMO 9920760)", "emissions_get_vessel_breakup"],
  ["Flip card", "Show me a flip card for Methane Sapphire (IMO 9710022)", "emissions_get_vessel_flip_card"],
  ["Love meter", "Show the love meter for Methane Sapphire (IMO 9710022) and Black Falcon (IMO 9920760)", "emissions_get_vessel_love_meter"],
];

describe("welcome chip routing (vessel-bound prompts)", () => {
  for (const [label, prompt, tool] of BOUND_CHIPS) {
    it(`"${label}" chip drives straight to ${tool} without re-asking`, async () => {
      const thread = await createThread({ tools: baseline });
      const result = await thread.send(prompt);

      expect(result).toHaveNoErrors();
      expect(result.toolCallNames).toContain(tool);
    });
  }
});
