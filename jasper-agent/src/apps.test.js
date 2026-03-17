import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCapabilityBroker } from "./broker/index.js";
import { getJasperAppStatus } from "./apps.js";
import { mergeDoctorStatus } from "./apps.js";

function createJasperHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "jasper-apps-"));
}

test("apps status is ready when no connector requests are pending", () => {
  const status = getJasperAppStatus({
    jasperHome: createJasperHome(),
  });

  assert.equal(status.status, "ready");
  assert.equal(status.connectors.length, 0);
  assert.equal(status.warnings.length, 0);
});

test("apps status summarizes pending connector requests", () => {
  const jasperHome = createJasperHome();
  const broker = createCapabilityBroker({ jasperHome });

  broker.acquireRequest("check my calendar tomorrow", {
    source: { kind: "test" },
  });
  broker.acquireRequest("summarize important unread email", {
    source: { kind: "test" },
  });
  broker.acquireRequest("check my calendar next week", {
    source: { kind: "test" },
  });

  const status = getJasperAppStatus({ jasperHome });

  assert.equal(status.status, "needs_attention");
  assert.equal(status.connectors.length, 2);
  assert.deepEqual(
    status.connectors
      .map((connector) => ({
        id: connector.id,
        status: connector.status,
        requestCount: connector.requestCount,
        requestedCapabilities: connector.requestedCapabilities,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    [
      {
        id: "calendar",
        status: "consent_required",
        requestCount: 2,
        requestedCapabilities: ["calendar.read"],
      },
      {
        id: "email",
        status: "consent_required",
        requestCount: 1,
        requestedCapabilities: ["email.read"],
      },
    ],
  );
  assert.match(status.nextSteps[0], /jasper apps/i);
});

test("doctor status includes app remediation when connectors are pending", () => {
  const merged = mergeDoctorStatus(
    {
      status: "ready",
      warnings: [],
      nextSteps: [],
    },
    {
      status: "needs_attention",
      warnings: ["1 connector request is waiting on consent or setup."],
      nextSteps: ["Run `jasper apps` to review blocked connector requests."],
      connectors: [
        {
          id: "calendar",
          status: "consent_required",
        },
      ],
    },
  );

  assert.equal(merged.status, "needs_attention");
  assert.equal(merged.apps.connectors.length, 1);
  assert.match(merged.warnings[0], /connector request/i);
  assert.match(merged.nextSteps[0], /jasper apps/i);
});
