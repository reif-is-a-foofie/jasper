import test from "node:test";
import assert from "node:assert/strict";
import { createEmailReadTool, resolveEmailWindow } from "./email-read.js";

test("resolveEmailWindow defaults to recent", () => {
  const window = resolveEmailWindow("what's new today");
  assert.equal(window.label, "today");
  assert.ok(window.end > window.start);
});

test("email-read tool calls injected runner", async () => {
  const tool = createEmailReadTool({
    emailReadRunner: async (request) => ({
      status: "ready",
      source: "test-mail",
      messages: [
        {
          subject: "Hello",
          sender: "me@example.com",
          received: request.start.toISOString(),
          snippet: "Preview",
        },
      ],
    }),
  });

  const output = await tool.run({ query: "latest" });
  assert.equal(output.status, "ready");
  assert.equal(output.source, "test-mail");
  assert.equal(output.messages.length, 1);
  assert.equal(output.messages[0].subject, "Hello");
});
