import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { cosineSimilarity } from "./embeddings.js";
import { createEventStore } from "./event-store.js";
import { DEFAULT_QDRANT_COLLECTION_NAME } from "./qdrant.js";

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeRuntimeConfig(jasperHome, config) {
  const configDir = path.join(jasperHome, "config");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, "runtime.json"),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );
}

function matchCondition(payload, condition) {
  const value = payload?.[condition.key];
  const expected = condition?.match?.value;
  if (Array.isArray(value)) {
    return value.includes(expected);
  }
  return value === expected;
}

function matchesFilter(payload, filter) {
  if (!filter) {
    return true;
  }

  if (Array.isArray(filter.must)) {
    for (const condition of filter.must) {
      if (!matchCondition(payload, condition)) {
        return false;
      }
    }
  }

  if (Array.isArray(filter.must_not)) {
    for (const condition of filter.must_not) {
      if (matchCondition(payload, condition)) {
        return false;
      }
    }
  }

  return true;
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }
  return body ? JSON.parse(body) : null;
}

async function startFakeQdrant() {
  const state = {
    collection: null,
    points: new Map(),
  };

  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(404);
      res.end();
      return;
    }

    const [pathname] = req.url.split("?");
    if (
      req.method === "GET" &&
      pathname === `/collections/${DEFAULT_QDRANT_COLLECTION_NAME}`
    ) {
      if (!state.collection) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: { error: "missing" } }));
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          result: {
            config: {
              params: {
                vectors: state.collection,
              },
            },
          },
        }),
      );
      return;
    }

    if (
      req.method === "PUT" &&
      pathname === `/collections/${DEFAULT_QDRANT_COLLECTION_NAME}`
    ) {
      const body = await readJson(req);
      state.collection = body.vectors;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", result: true }));
      return;
    }

    if (
      req.method === "PUT" &&
      pathname === `/collections/${DEFAULT_QDRANT_COLLECTION_NAME}/points`
    ) {
      const body = await readJson(req);
      for (const point of body.points || []) {
        state.points.set(String(point.id), point);
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", result: { operation_id: 1 } }));
      return;
    }

    if (
      req.method === "POST" &&
      pathname === `/collections/${DEFAULT_QDRANT_COLLECTION_NAME}/points/query`
    ) {
      const body = await readJson(req);
      const results = [...state.points.values()]
        .filter((point) => matchesFilter(point.payload, body.filter))
        .map((point) => ({
          id: point.id,
          payload: point.payload,
          score: cosineSimilarity(body.query, point.vector),
        }))
        .filter((point) => point.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, Number(body.limit || 10));

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", result: { points: results } }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: { error: "unknown route" } }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind fake Qdrant server");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    state,
    async close() {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

test("materializes raw events into the local Qdrant semantic layer", async () => {
  const fakeQdrant = await startFakeQdrant();

  try {
    const jasperHome = createTempDir("jasper-home-");
    const memoryRoot = path.join(jasperHome, "data", "memory");

    writeRuntimeConfig(jasperHome, {
      schemaVersion: 1,
      jasperHome,
      memoryRoot,
      services: {
        qdrant: {
          enabled: true,
          mode: "external",
          url: fakeQdrant.url,
          collection: {
            name: DEFAULT_QDRANT_COLLECTION_NAME,
            embeddingDimension: 64,
            distance: "Cosine",
          },
        },
      },
    });

    const store = createEventStore({ root: memoryRoot, jasperHome });
    store.appendEvent({
      type: "task.follow-up",
      source: "email",
      tags: ["household", "ops"],
      payload: { note: "Schedule the household billing review." },
    });
    store.appendEvent({
      type: "task.shopping",
      source: "notes",
      tags: ["errands"],
      payload: { note: "Buy lemons." },
    });

    const materialized = await store.materializeSemanticIndex();
    assert.equal(materialized.provider, "qdrant");
    assert.equal(materialized.collectionName, DEFAULT_QDRANT_COLLECTION_NAME);
    assert.equal(materialized.indexedEventCount, 2);
    assert.equal(fakeQdrant.state.points.size, 2);

    const results = await store.searchSemanticEvents({
      query: "household billing operations",
      limit: 2,
      type: "task.follow-up",
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].type, "task.follow-up");
    assert.equal(results[0].source, "email");
  } finally {
    await fakeQdrant.close();
  }
});

test("falls back to local semantic retrieval when Qdrant is unavailable", async () => {
  const jasperHome = createTempDir("jasper-home-");
  const memoryRoot = path.join(jasperHome, "data", "memory");

  writeRuntimeConfig(jasperHome, {
    schemaVersion: 1,
    jasperHome,
    memoryRoot,
    services: {
      qdrant: {
        enabled: true,
        mode: "external",
        url: "http://127.0.0.1:9",
        collection: {
          name: DEFAULT_QDRANT_COLLECTION_NAME,
          embeddingDimension: 64,
          distance: "Cosine",
        },
      },
    },
  });

  const store = createEventStore({ root: memoryRoot, jasperHome });
  store.appendEvent({
    type: "task.follow-up",
    source: "email",
    tags: ["household", "ops"],
    payload: { note: "Check the payment reminder." },
  });

  const results = await store.searchSemanticEvents({
    query: "household payment reminder",
    limit: 1,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].type, "task.follow-up");
});
