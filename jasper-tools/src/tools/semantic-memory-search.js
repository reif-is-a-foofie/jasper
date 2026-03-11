function normalizeLimit(value, fallback = 5) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function createSemanticMemorySearchTool(context) {
  return {
    id: "semantic-memory-search",
    description: "Search Jasper memory using deterministic semantic retrieval.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
        type: { type: "string" },
        source: { type: "string" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    async run(input = {}) {
      if (!String(input.query || "").trim()) {
        throw new Error('Tool "semantic-memory-search" requires a non-empty query');
      }

      return context.memory.searchSemanticEvents({
        query: input.query,
        limit: normalizeLimit(input.limit, 5),
        type: input.type,
        source: input.source,
      });
    },
  };
}
