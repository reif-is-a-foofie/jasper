import { getJasperAppStatus } from "../../../jasper-agent/src/apps.js";

export function createAppsStatusTool(context) {
  return {
    id: "apps-status",
    description: "Return pending Jasper connector and app requests.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async run() {
      return getJasperAppStatus({
        jasperHome: context.jasperHome,
      });
    },
  };
}
