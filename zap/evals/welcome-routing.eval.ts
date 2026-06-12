import { describe, it, expect } from "vitest";
import { createThread, MockTools, mock } from "@0north/zap-eval-harness";

// A bare greeting opens the ZN Tinder welcome card; an explicit "swipe" routes to
// the match deck. Both welcome and the deck aggregate the fleet, so we mock the
// fleet list plus the two tools.
const FLEET = [
  { imo: "9710022", name: "Methane Sapphire", type: "LNG carrier" },
  { imo: "9920760", name: "Captain's Pride", type: "Bulk carrier" },
];

const WELCOME = {
  operatorName: "Uma",
  fleetCount: 2,
  matchesThisWeek: 2,
  co2SavedTons: 74000,
  etsAvoidedEur: 412000,
  dramaScore: 0,
  dramaCaption: "Today's reading: suspiciously calm — everyone's behaving.",
  mostEligible: { name: "Methane Sapphire", ciiGrade: "A", blurb: "CII grade A · FuelEU surplus" },
  suggestions: [{ label: "Swipe the card", icon: "💘", prompt: "Swipe through vessel matches" }],
  dataSource: "fixture",
  message: "Demo fixture data.",
};

const TRAFFIC_SIGNAL = {
  base: { name: "your fleet" },
  candidates: [
    {
      name: "Methane Sapphire",
      imo: "9710022",
      cii: "A",
      signal: "green",
      verdict: "Green light — go.",
      blurb: "CII A and a clean balance sheet — swipe right with confidence.",
      type: "LNG carrier",
      age: 2,
      dwt: 95000,
      fuel: "LNG",
    },
  ],
};

const TINDER_VOYAGE = {
  base: { name: "Methane Sapphire", from: "Rotterdam", to: "Singapore", cii: "A" },
  voyageDistanceNm: 8300,
  candidates: [
    { name: "Captain's Pride", type: "Bulk carrier", from: "Rotterdam", to: "Singapore", cii: "C", euPortActivity: 67 },
  ],
};

const baseline = new MockTools()
  .mock("emissions_get_vessel_welcome", mock.static(WELCOME))
  // present_welcome is the interactive (approval) card; in evals there's no user to
  // click a chip, so mock it returning a chosen prompt to let routing proceed.
  .mock("emissions_present_welcome", mock.static({ prompt: "Show me a recent breakup" }))
  .mock("emissions_get_vessel_breakup", mock.static({}))
  .mock("emissions_get_vessel_traffic_signal", mock.static(TRAFFIC_SIGNAL))
  .mock("emissions_get_vessel_tinder_voyage", mock.static(TINDER_VOYAGE))
  .mock("vessel_get_fleet_vessels", mock.static(FLEET));

const GREETINGS = ["Hi", "Hey", "Hello", "Ahoy", "Good morning", "Hey there 👋"];

describe("welcome routing", () => {
  for (const prompt of GREETINGS) {
    it(`a bare greeting shows the welcome card: "${prompt}"`, async () => {
      const thread = await createThread({ tools: baseline });
      const result = await thread.send(prompt);

      expect(result).toHaveNoErrors();
      expect(result.toolCallNames).toContain("emissions_get_vessel_welcome");
      // The greeting must be a single quick step — it must NOT call fleet data.
      expect(result.toolCallNames).not.toContain("vessel_get_fleet_vessels");
    });
  }

  it("'swipe the card' routes to the traffic-signal match deck", async () => {
    const thread = await createThread({ tools: baseline });
    const result = await thread.send("Swipe the card");

    expect(result).toHaveNoErrors();
    expect(result.toolCallNames).toContain("emissions_get_vessel_traffic_signal");
  });

  it("'find a voyage match' routes to the voyage deck", async () => {
    const thread = await createThread({ tools: baseline });
    const result = await thread.send("Find a voyage match");

    expect(result).toHaveNoErrors();
    expect(result.toolCallNames).toContain("emissions_get_vessel_tinder_voyage");
  });

  // A greeting that also carries an explicit instruction follows the instruction,
  // not the welcome card (mirrors the hello sanity eval).
  it("a greeting with an explicit instruction does not force the welcome card", async () => {
    const thread = await createThread({ tools: baseline });
    const result = await thread.send("Hi! Please reply with the word 'hello'.");

    expect(result).toHaveNoErrors();
    expect(result.response.toLowerCase()).toContain("hello");
    expect(result.toolCallNames).not.toContain("emissions_get_vessel_welcome");
  });
});
