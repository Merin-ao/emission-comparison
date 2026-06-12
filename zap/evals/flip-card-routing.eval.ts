import { describe, it, expect } from "vitest";
import { createThread, MockTools, mock } from "@0north/zap-eval-harness";

// The flip card reuses the biodata payload, so one fixture serves both tools.
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

const FLEET = [{ imo: "9710022", name: "Methane Sapphire", type: "LNG carrier" }];

const baseline = new MockTools()
  .mock("emissions_get_vessel_flip_card", mock.static(BIODATA))
  .mock("emissions_get_vessel_biodata", mock.static(BIODATA))
  .mock("vessel_get_fleet_vessels", mock.static(FLEET));

// Explicit "card" phrasings must resolve to the flip card.
const FLIP_PHRASINGS = [
  "Show me a flip card for vessel 9710022.",
  "Give me the trading card for vessel 9710022.",
  "Show the card view of vessel 9710022.",
  "Swipe card for vessel 9710022, please.",
];

describe("flip-card routing", () => {
  for (const prompt of FLIP_PHRASINGS) {
    it(`routes to the flip card for: "${prompt}"`, async () => {
      const thread = await createThread({ tools: baseline });
      const result = await thread.send(prompt);

      expect(result).toHaveNoErrors();
      expect(result.toolCallNames).toContain("emissions_get_vessel_flip_card");
    });
  }

  // The flip card must NOT cannibalise the default single-vessel biodata ask.
  it("a plain 'tell me about' ask still routes to biodata, not the flip card", async () => {
    const thread = await createThread({ tools: baseline });
    const result = await thread.send("Tell me about vessel 9710022.");

    expect(result).toHaveNoErrors();
    expect(result.toolCallNames).toContain("emissions_get_vessel_biodata");
    expect(result.toolCallNames).not.toContain("emissions_get_vessel_flip_card");
  });
});
