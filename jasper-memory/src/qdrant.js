import fs from "node:fs";
import path from "node:path";

export const DEFAULT_QDRANT_COLLECTION_NAME = "jasper-memory-events";
export const DEFAULT_QDRANT_DISTANCE = "Cosine";
export const DEFAULT_QDRANT_TIMEOUT_MS = 10_000;

function normalizeBaseUrl(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

function normalizeTimeoutMs(value, fallback = DEFAULT_QDRANT_TIMEOUT_MS) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeLimit(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function buildPointPayload(event, embedding) {
  return {
    schemaVersion: Number(event.schemaVersion ?? 1),
    eventId: event.id,
    ts: event.ts,
    type: event.type,
    source: event.source,
    tags: Array.isArray(event.tags) ? event.tags : [],
    sessionId: event.session?.id || null,
    payload: event.payload || {},
    embeddingText: embedding.text,
  };
}

function matchCondition(key, value) {
  return {
    key,
    match: { value },
  };
}

function buildFilter(options = {}) {
  const must = [];
  const mustNot = [];

  if (options.type) {
    must.push(matchCondition("type", String(options.type)));
  }

  if (options.source) {
    must.push(matchCondition("source", String(options.source)));
  }

  if (Array.isArray(options.tags)) {
    for (const tag of options.tags
      .map((item) => String(item || "").trim())
      .filter(Boolean)) {
      must.push(matchCondition("tags", tag));
    }
  }

  if (options.excludeSessionId) {
    mustNot.push(matchCondition("sessionId", String(options.excludeSessionId)));
  }

  if (must.length === 0 && mustNot.length === 0) {
    return null;
  }

  return {
    ...(must.length > 0 ? { must } : {}),
    ...(mustNot.length > 0 ? { must_not: mustNot } : {}),
  };
}

function parseJsonBody(rawText) {
  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function parseCollectionConfig(payload) {
  const vectors =
    payload?.result?.config?.params?.vectors ||
    payload?.result?.config?.params?.vectors_config ||
    null;

  if (!vectors || typeof vectors !== "object" || Array.isArray(vectors)) {
    return null;
  }

  return {
    size: Number(vectors.size),
    distance: String(vectors.distance || ""),
  };
}

function normalizeQueryResult(payload) {
  if (Array.isArray(payload?.result)) {
    return payload.result;
  }

  if (Array.isArray(payload?.result?.points)) {
    return payload.result.points;
  }

  return [];
}

function restoreEventFromPayload(point) {
  const payload = point?.payload || {};
  const sessionId = payload.sessionId ? String(payload.sessionId) : null;

  return {
    schemaVersion: Number(payload.schemaVersion ?? 1),
    id: String(payload.eventId || point.id || ""),
    ts: payload.ts || null,
    type: payload.type || "",
    source: payload.source || "",
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    session: sessionId ? { id: sessionId } : null,
    payload:
      payload.payload &&
      typeof payload.payload === "object" &&
      !Array.isArray(payload.payload)
        ? payload.payload
        : { value: payload.payload ?? null },
    vectorScore: Number(point?.score ?? 0),
  };
}

function defaultSyncState(options = {}) {
  return {
    schemaVersion: 1,
    collectionName: String(
      options.collectionName || DEFAULT_QDRANT_COLLECTION_NAME,
    ),
    embeddingDimension: Number(options.embeddingDimension || 64),
    syncedEmbeddingCount: 0,
    updatedAt: null,
  };
}

function readSyncState(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    return defaultSyncState(options);
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object") {
      return defaultSyncState(options);
    }

    if (
      parsed.collectionName !==
        String(options.collectionName || DEFAULT_QDRANT_COLLECTION_NAME) ||
      Number(parsed.embeddingDimension) !==
        Number(options.embeddingDimension || 64)
    ) {
      return defaultSyncState(options);
    }

    return {
      ...defaultSyncState(options),
      ...parsed,
    };
  } catch {
    return defaultSyncState(options);
  }
}

function writeSyncState(filePath, state) {
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export class JasperQdrantMemoryIndex {
  constructor(options = {}) {
    this.url = normalizeBaseUrl(options.url);
    this.collectionName = String(
      options.collectionName || DEFAULT_QDRANT_COLLECTION_NAME,
    ).trim();
    this.embeddingDimension = Math.max(
      8,
      Number(options.embeddingDimension ?? 64),
    );
    this.distance =
      String(options.distance || DEFAULT_QDRANT_DISTANCE).trim() ||
      DEFAULT_QDRANT_DISTANCE;
    this.timeoutMs = normalizeTimeoutMs(options.timeoutMs);
    this.syncStatePath = path.resolve(options.syncStatePath);
  }

  isConfigured() {
    return Boolean(this.url && this.collectionName);
  }

  async request(method, resourcePath, body, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.url}${resourcePath}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(options.headers || {}),
        },
        signal: controller.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const rawText = await response.text();
      const payload = parseJsonBody(rawText);

      if (!response.ok) {
        const errorMessage =
          payload?.status?.error ||
          payload?.error ||
          rawText.trim() ||
          `HTTP ${response.status}`;
        const error = new Error(
          `Qdrant ${method} ${resourcePath} failed: ${errorMessage}`,
        );
        error.statusCode = response.status;
        throw error;
      }

      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getCollection() {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      return await this.request(
        "GET",
        `/collections/${encodeURIComponent(this.collectionName)}`,
      );
    } catch (error) {
      if (error && typeof error === "object" && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async ensureCollection() {
    if (!this.isConfigured()) {
      return null;
    }

    const existing = await this.getCollection();
    const existingConfig = parseCollectionConfig(existing);
    if (existingConfig) {
      if (existingConfig.size !== this.embeddingDimension) {
        throw new Error(
          `Qdrant collection "${this.collectionName}" uses vector size ${existingConfig.size}, expected ${this.embeddingDimension}`,
        );
      }

      if (
        existingConfig.distance &&
        existingConfig.distance.toLowerCase() !== this.distance.toLowerCase()
      ) {
        throw new Error(
          `Qdrant collection "${this.collectionName}" uses distance ${existingConfig.distance}, expected ${this.distance}`,
        );
      }

      return {
        status: "ready",
        action: "reused",
        name: this.collectionName,
        embeddingDimension: this.embeddingDimension,
        distance: this.distance,
      };
    }

    await this.request(
      "PUT",
      `/collections/${encodeURIComponent(this.collectionName)}`,
      {
        vectors: {
          size: this.embeddingDimension,
          distance: this.distance,
        },
      },
    );

    return {
      status: "ready",
      action: "created",
      name: this.collectionName,
      embeddingDimension: this.embeddingDimension,
      distance: this.distance,
    };
  }

  async upsertPoints(points) {
    if (!Array.isArray(points) || points.length === 0) {
      return;
    }

    await this.request(
      "PUT",
      `/collections/${encodeURIComponent(this.collectionName)}/points?wait=true`,
      { points },
    );
  }

  async syncPendingEmbeddings(eventStore) {
    if (!this.isConfigured()) {
      return {
        status: "disabled",
        syncedEmbeddingCount: 0,
      };
    }

    await this.ensureCollection();

    const embeddings = eventStore.readEmbeddings();
    const state = readSyncState(this.syncStatePath, {
      collectionName: this.collectionName,
      embeddingDimension: this.embeddingDimension,
    });
    const startIndex =
      state.syncedEmbeddingCount > embeddings.length
        ? 0
        : state.syncedEmbeddingCount;
    const unsynced = embeddings.slice(startIndex);
    if (unsynced.length === 0) {
      return {
        status: "up-to-date",
        syncedEmbeddingCount: state.syncedEmbeddingCount,
      };
    }

    const eventMap = new Map(
      eventStore.readEvents().map((event) => [event.id, event]),
    );
    const batchSize = 128;
    let syncedEmbeddingCount = startIndex;

    for (let index = 0; index < unsynced.length; index += batchSize) {
      const batch = unsynced.slice(index, index + batchSize);
      const points = batch
        .map((embedding) => {
          const event = eventMap.get(embedding.eventId);
          if (!event) {
            return null;
          }

          return {
            id: event.id,
            vector: embedding.vector,
            payload: buildPointPayload(event, embedding),
          };
        })
        .filter(Boolean);

      if (points.length > 0) {
        await this.upsertPoints(points);
      }

      syncedEmbeddingCount = startIndex + index + batch.length;
      writeSyncState(this.syncStatePath, {
        schemaVersion: 1,
        collectionName: this.collectionName,
        embeddingDimension: this.embeddingDimension,
        syncedEmbeddingCount,
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      status: "ready",
      syncedEmbeddingCount,
    };
  }

  async queryPoints(queryVector, options = {}) {
    const body = {
      query: queryVector,
      limit: normalizeLimit(options.limit, 10),
      with_payload: true,
      with_vector: false,
    };
    const filter = buildFilter(options);
    if (filter) {
      body.filter = filter;
    }

    try {
      const payload = await this.request(
        "POST",
        `/collections/${encodeURIComponent(this.collectionName)}/points/query`,
        body,
      );
      return normalizeQueryResult(payload).map(restoreEventFromPayload);
    } catch (error) {
      if (!(error && typeof error === "object" && error.statusCode === 404)) {
        throw error;
      }
    }

    const legacyPayload = await this.request(
      "POST",
      `/collections/${encodeURIComponent(this.collectionName)}/points/search`,
      {
        vector: queryVector,
        limit: normalizeLimit(options.limit, 10),
        with_payload: true,
        with_vector: false,
        ...(filter ? { filter } : {}),
      },
    );

    return normalizeQueryResult(legacyPayload).map(restoreEventFromPayload);
  }
}

export function createQdrantMemoryIndex(options = {}) {
  return new JasperQdrantMemoryIndex(options);
}
