import test from "node:test";
import assert from "node:assert/strict";
import { createComputerUseManager } from "./computer-use.js";

function createFakeMemory() {
  const events = [];
  return {
    appendEvent(event) {
      const stored = {
        ...event,
        id: `evt_${events.length + 1}`,
        ts: event.ts || new Date().toISOString(),
      };
      events.push(stored);
      return stored;
    },
    listRecentEvents({ limit = 200 } = {}) {
      return [...events].slice(-limit).reverse();
    },
  };
}

test("creates and lists computer action plans", () => {
  const memory = createFakeMemory();
  const manager = createComputerUseManager({ memory });

  const plan = manager.createPlan({
    title: "Download statement",
    steps: ["open browser", "download file"],
    requiresApproval: true,
  });

  assert.equal(plan.title, "Download statement");
  assert.equal(plan.status, "approval_required");
  const plans = manager.listPlans({ limit: 5 });
  assert.ok(plans.some((entry) => entry.planId === plan.planId));
});

test("approves plan and runs it", () => {
  const memory = createFakeMemory();
  const manager = createComputerUseManager({ memory });

  const plan = manager.createPlan({
    title: "Open site",
    steps: ["navigate"],
    requiresApproval: true,
  });

  manager.requireApproval(plan.planId, "Need consent");
  const approved = manager.approvePlan(plan.planId);
  assert.equal(approved.status, "ready");

  const executed = manager.runPlan({ planId: plan.planId });
  assert.equal(executed.status, "completed");
  assert.ok(executed.executionCount > 0);
});
