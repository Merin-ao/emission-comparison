import { describe, it, expect } from "vitest";
import { createThread, MockTools, mock } from "@0north/zap-eval-harness";

// A realistic biodata payload (mirrors the widget schema's worked example) so
// the agent has something coherent to narrate after the routing decision.
const BIODATA = {
  name: "Methane Sapphire",
  imo: "9710022",
  type: "LNG carrier",
  state: "good",
  stampLabel: "Marriage material",
  seek: "Seeking a long-term charterer who appreciates a tasteful FuelEU surplus.",
  particulars: [
    { k: "Date of build", v: "2024 · 2 yrs" },
    { k: "Build & stature", v: "95,000 DWT" },
    { k: "Profession", v: "LNG carrier" },
    { k: "Star sign (CII)", v: "A · 4.92", tone: "good" },
    { k: "Last year's sign", v: "A · 5.10", tone: "good" },
  ],
  voyages: [{ k: "Distance travelled (nm)", v: "84,200" }],
  financial: [
    { k: "Carbon dowry (EU ETS)", v: "€0", tone: "good" },
    { k: "FuelEU position", v: "+1,820 t surplus", tone: "good" },
    { k: "CO₂eq (WTW)", v: "31,200 t" },
  ],
  disclosure: { clean: true, text: "None worth mentioning. Compliance in good standing." },
  funFacts: ["🎂 Built in 2024 — practically a teenager in vessel years."],
  signoff: "References available on request.",
};

// Fleet lookup the agent may consult to resolve a name → IMO. Mocked so it
// never hits a live backend; pinned IMO matches the biodata payload.
const FLEET = [{ imo: "9710022", name: "Methane Sapphire", type: "LNG carrier" }];

const baseline = new MockTools()
  .mock("emissions_get_vessel_biodata", mock.static(BIODATA))
  .mock("vessel_get_fleet_vessels", mock.static(FLEET));

// Every phrasing below must resolve to the biodata card, not the emissions card.
const PHRASINGS = [
  "Show me bio data for vessel 9710022.",
  "Tell me about the vessel 9710022.",
  "Show details for vessel 9710022.",
  "Show me the portfolio for vessel 9710022.",
  "Give me information about vessel 9710022.",
  "What is this vessel? IMO 9710022.",
];

describe("biodata routing — open-ended vessel asks go to biodata", () => {
  for (const prompt of PHRASINGS) {
    it(`routes to biodata for: "${prompt}"`, async () => {
      const thread = await createThread({ tools: baseline });
      const result = await thread.send(prompt);

      expect(result).toHaveNoErrors();
      expect(result.toolCallNames).toContain("emissions_get_vessel_biodata");
      // Open-ended asks must NOT fall through to the emissions/CII card.
      expect(result.toolCallNames).not.toContain("emissions_get_vessel_emissions");
    });
  }

  it("uses the vessel from conversation context for a follow-up ('the vessel')", async () => {
    const thread = await createThread({ tools: baseline });
    await thread.send("Tell me about vessel 9710022.");
    const result = await thread.send("Remind me — what is this vessel?");

    expect(result).toHaveNoErrors();
    expect(result.toolCallNames).toContain("emissions_get_vessel_biodata");
  });
});
