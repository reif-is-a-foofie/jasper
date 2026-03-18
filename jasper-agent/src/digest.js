import { createEventStore } from "../../jasper-memory/src/event-store.js";
import { getJasperAppStatus } from "./apps.js";

function normalizeLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseEventTimestamp(event) {
  const timestamp = Date.parse(event?.ts || "");
  if (!Number.isFinite(timestamp)) {
    return 0;
  }
  return timestamp;
}

function truncate(value, limit = 140) {
  const text =
    typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 3)}...`;
}

function describePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const priorityKeys = ["summary", "note", "request", "description", "value"];
  for (const key of priorityKeys) {
    if (payload[key]) {
      return truncate(payload[key]);
    }
  }

  const keys = Object.keys(payload);
  if (keys.length === 0) {
    return "";
  }

  return truncate(JSON.stringify(payload));
}

function summarizeEvents(events) {
  return events.map((event) => ({
    time: event.ts || null,
    type: event.type,
    detail: describePayload(event.payload),
  }));
}

function defaultFetchAppStatus(options) {
  return getJasperAppStatus({
    jasperHome: options.jasperHome,
    acquisitionStore: options.acquisitionStore,
    connectorStore: options.connectorStore,
  });
}

export function createDigestReporter(options = {}) {
  const memory =
    options.memory ||
    createEventStore({
      root: options.memoryRoot,
      jasperHome: options.jasperHome,
      source: "jasper-digest",
    });
  const fetchAppStatus =
    options.fetchAppStatus ||
    ((extra = {}) =>
      defaultFetchAppStatus({
        jasperHome: options.jasperHome,
        ...extra,
      }));

  return {
    async generateDigest(digestOptions = {}) {
      const stageValue = String(digestOptions.stage || "manual").trim() || "manual";
      const stage = stageValue.toLowerCase();
      const lookbackHoursCandidate = Number(digestOptions.lookbackHours ?? 6);
      const lookbackHours = Number.isFinite(lookbackHoursCandidate)
        ? Math.max(0.25, lookbackHoursCandidate)
        : 6;
      const eventLimit = normalizeLimit(digestOptions.eventLimit, 5);

      const now =
        digestOptions.until instanceof Date
          ? digestOptions.until
          : new Date(digestOptions.until || Date.now());
      const since = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);

      const events = memory
        .readEvents()
        .map((event) => ({ event, timestamp: parseEventTimestamp(event) }))
        .filter(
          ({ timestamp }) =>
            timestamp >= since.getTime() && timestamp <= now.getTime(),
        )
        .sort((left, right) => right.timestamp - left.timestamp)
        .slice(0, eventLimit)
        .map(({ event }) => event);

      const appStatus = fetchAppStatus(digestOptions.appStatusOptions);

      const connectorsNeedAttention = (appStatus?.connectors || []).filter(
        (connector) => connector.needsAttention,
      );
      const eventHighlights = summarizeEvents(events);

      const summaryLines = [];
      summaryLines.push(`Digest ${stage} at ${now.toISOString()}.`);

      if (connectorsNeedAttention.length > 0) {
        summaryLines.push(
          `Needs attention: ${connectorsNeedAttention
            .map(
              (connector) =>
                `${connector.label || connector.id} (${connector.status})`,
            )
            .join(", ")}.`,
        );
      } else {
        summaryLines.push("All connectors are approved or tracked.");
      }

      const warnings = Array.isArray(appStatus?.warnings)
        ? appStatus.warnings
        : [];
      if (warnings.length > 0) {
        summaryLines.push(`Warnings: ${warnings.join(" ")}`);
      }

      if (eventHighlights.length > 0) {
        summaryLines.push("Recent observations:");
        for (const highlight of eventHighlights) {
          const detail = highlight.detail ? ` (${highlight.detail})` : "";
          summaryLines.push(`- ${highlight.time}: ${highlight.type}${detail}`);
        }
      } else {
        summaryLines.push("No new observations recorded.");
      }

      const nextSteps = Array.isArray(appStatus?.nextSteps)
        ? appStatus.nextSteps
        : [];
      if (nextSteps.length > 0) {
        summaryLines.push(`Next steps: ${nextSteps.join(" ")}`);
      }

      return {
        stage,
        timestamp: now.toISOString(),
        lookbackHours,
        connectors: appStatus?.connectors || [],
        connectorsNeedAttention,
        warnings,
        nextSteps,
        eventHighlights,
        summaryLines,
        summaryText: summaryLines.join(" "),
      };
    },
  };
}
