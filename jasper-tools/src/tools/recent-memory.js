function normalizeLimit(value, fallback = 5) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function createRecentMemoryTool(context) {
  return {
    id: "recent-memory",
    description: "Return the most recent Jasper memory events.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        type: { type: "string" },
        source: { type: "string" },
      },
      additionalProperties: false,
    },
    async run(input = {}) {
      return context.memory.listRecentEvents({
        limit: normalizeLimit(input.limit, 5),
        type: input.type,
        source: input.source,
      });
    },
  };
}
