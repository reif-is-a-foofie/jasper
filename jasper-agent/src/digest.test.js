import test from "node:test";
import assert from "node:assert/strict";
import { createDigestReporter } from "./digest.js";

test("digest reporter highlights connectors and recent events", async () => {
  const fakeEvents = [
    {
      ts: new Date().toISOString(),
      type: "listener.filesystem",
      payload: { summary: "Updated README.md" },
    },
    {
      ts: new Date().toISOString(),
      type: "connector.activated",
      payload: { connectorId: "email" },
    },
  ];
  const reporter = createDigestReporter({
    memory: {
      readEvents: () => fakeEvents,
    },
    fetchAppStatus: () => ({
      connectors: [
        {
          id: "calendar",
          label: "Calendar",
          status: "consent_required",
          needsAttention: true,
        },
        {
          id: "email",
          label: "Email",
          status: "ready",
          needsAttention: false,
        },
      ],
      warnings: ["Calendar needs consent", "Activation pending"],
      nextSteps: ["Approve calendar connector"],
    }),
  });

  const digest = await reporter.generateDigest({
    stage: "morning",
    lookbackHours: 1,
    eventLimit: 2,
  });

  assert.equal(digest.stage, "morning");
  assert.strictEqual(digest.connectorsNeedAttention.length, 1);
  assert.ok(digest.summaryLines.some((line) => line.includes("Needs attention")));
  assert.strictEqual(digest.eventHighlights.length, 2);
  const highlightTypes = digest.eventHighlights.map(({ type }) => type);
  assert.ok(highlightTypes.includes(fakeEvents[0].type));
  assert.ok(highlightTypes.includes(fakeEvents[1].type));
});
