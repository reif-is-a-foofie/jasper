import test from "node:test";
import assert from "node:assert/strict";
import { createCalendarReadTool } from "./calendar-read.js";
import { resolveCalendarWindow } from "./calendar-read.js";

test("resolveCalendarWindow recognizes tomorrow queries", () => {
  const window = resolveCalendarWindow("check my calendar tomorrow morning");

  assert.equal(window.label, "tomorrow");
  assert.equal(window.start.getHours(), 0);
  assert.equal(window.start.getMinutes(), 0);
});

test("resolveCalendarWindow recognizes next week queries", () => {
  const window = resolveCalendarWindow("what changed on my calendar next week");

  assert.equal(window.label, "next_week");
  assert.ok(window.end > window.start);
});

test("calendar-read tool delegates to the injected runner", async () => {
  const tool = createCalendarReadTool({
    calendarReadRunner: async (request) => ({
      status: "ready",
      source: "test-calendar",
      events: [
        {
          title: "Design review",
          start: request.start.toISOString(),
          end: request.end.toISOString(),
        },
      ],
    }),
  });

  const output = await tool.run({
    query: "check my calendar tomorrow",
    limit: 3,
  });

  assert.equal(output.status, "ready");
  assert.equal(output.source, "test-calendar");
  assert.equal(output.window.label, "tomorrow");
  assert.equal(output.events.length, 1);
  assert.equal(output.events[0].title, "Design review");
});
