import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  describeExternalBenchmarkQueue,
  JasperExternalBenchmarkStore,
  buildExternalBenchmarkTemplate,
  computeExternalBenchmarkIndex,
  listExternalBenchmarks,
} from "./external-benchmark-index.js";

function createJasperHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "jasper-external-benchmarks-"));
}

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
    readEvents() {
      return events;
    },
  };
}

test("template includes the full benchmark basket", () => {
  const template = buildExternalBenchmarkTemplate();
  const benchmarks = listExternalBenchmarks();
  const totalWeight = Object.values(template.weights).reduce(
    (sum, value) => sum + Number(value),
    0,
  );

  assert.equal(template.results.length, benchmarks.length);
  assert.equal(template.weights.terminal_bench, 12);
  assert.equal(totalWeight, 100);
  assert.ok(template.results.some((entry) => entry.benchmarkId === "gaia"));
  assert.ok(
    template.results.some(
      (entry) => entry.benchmarkId === "webarena_verified",
    ),
  );
});

test("imported results produce weighted index and coverage", () => {
  const jasperHome = createJasperHome();
  const memory = createFakeMemory();
  const store = new JasperExternalBenchmarkStore({ jasperHome, memory });
  const importFile = path.join(jasperHome, "benchmark-results.json");

  fs.writeFileSync(
    importFile,
    JSON.stringify(
      {
        weights: {
          terminal_bench: 20,
        },
        results: [
          {
            benchmarkId: "terminal_bench",
            passed: 8,
            total: 10,
            runAt: "2026-03-19T00:00:00.000Z",
            sourceName: "manual-run",
          },
          {
            benchmarkId: "gaia",
            accuracy: 0.6,
            runAt: "2026-03-18T00:00:00.000Z",
          },
          {
            benchmarkId: "workarena",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  const imported = store.importResults(importFile);
  const index = computeExternalBenchmarkIndex({
    jasperHome,
    memory,
    weightOverrides: imported.weightOverrides,
  });

  assert.equal(imported.importedCount, 2);
  assert.equal(imported.skippedCount, 1);
  assert.equal(index.coveredBenchmarks, 2);
  assert.equal(index.weightMode, "override_file");
  assert.equal(index.coveragePercent, 25.93);
  assert.equal(index.coveredScore, 74.29);
  assert.equal(index.indexScore, 19.26);
  assert.ok(
    memory
      .readEvents()
      .some((event) => event.type === "evaluation.external.result"),
  );
});

test("latest result wins when the same benchmark is recorded twice", () => {
  const jasperHome = createJasperHome();
  const store = new JasperExternalBenchmarkStore({
    jasperHome,
    memory: createFakeMemory(),
  });

  store.recordResult({
    benchmarkId: "terminal_bench",
    scorePercent: 50,
    runAt: "2026-03-17T00:00:00.000Z",
  });
  store.recordResult({
    benchmarkId: "terminal_bench",
    scorePercent: 70,
    runAt: "2026-03-19T00:00:00.000Z",
  });

  const index = computeExternalBenchmarkIndex({ jasperHome });
  const terminalBench = index.benchmarks.find(
    (benchmark) => benchmark.id === "terminal_bench",
  );

  assert.equal(terminalBench.scorePercent, 70);
  assert.equal(index.coveredBenchmarks, 1);
});

test("benchmark queue is ordered by priority and starts with the wired runner", () => {
  const queue = describeExternalBenchmarkQueue();

  assert.equal(queue[0].id, "terminal_bench");
  assert.equal(queue[0].integrationStatus, "running");
  assert.equal(queue[0].runnerPath, "scripts/run_terminal_bench_with_jasper.py");
  assert.equal(queue[1].id, "swe_bench_verified");
  assert.equal(queue.at(-1).id, "asb");
});
