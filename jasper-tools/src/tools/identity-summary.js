export function createIdentitySummaryTool(context) {
  return {
    id: "identity-summary",
    description: "Return Jasper identity, mission, and personality details.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async run() {
      return {
        path: context.identity.path,
        identity: context.identity.config.identity,
        mission: context.identity.config.mission,
        personality: context.identity.config.personality,
      };
    },
  };
}
