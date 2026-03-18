import { createEventStore } from "../../jasper-memory/src/event-store.js";
import { createConnectorStore } from "./connector-store.js";
import { createToolAcquisitionStore } from "./broker/acquisition-store.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function connectorLabel(connectorId) {
  const normalized = normalizeText(connectorId);
  if (!normalized) {
    return "Unknown";
  }

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusForRecord(record) {
  if (record.status === "awaiting_consent") {
    return "consent_required";
  }

  if (
    record.status === "satisfied" ||
    record.primaryProvider?.status === "available"
  ) {
    return "ready";
  }

  return "tracked";
}

function sortByMostRecent(left, right) {
  return String(right.latestRequestAt || "").localeCompare(
    String(left.latestRequestAt || ""),
  );
}

function summarizeConnectors(records) {
  const summaries = new Map();

  for (const record of records) {
    const connectorId = normalizeText(record.primaryProvider?.connectorId);
    if (!connectorId) {
      continue;
    }

    const summary =
      summaries.get(connectorId) ||
      {
        id: connectorId,
        label: connectorLabel(connectorId),
        status: "tracked",
        requestCount: 0,
        latestRequestAt: null,
        requestedCapabilities: new Set(),
        recentRequests: [],
      };

    summary.requestCount += 1;
    summary.latestRequestAt =
      !summary.latestRequestAt ||
      String(record.updatedAt || "") > String(summary.latestRequestAt)
        ? record.updatedAt || null
        : summary.latestRequestAt;
    if (record.primaryCapabilityId) {
      summary.requestedCapabilities.add(record.primaryCapabilityId);
    }
    if (summary.recentRequests.length < 3) {
      summary.recentRequests.push({
        recordId: record.id,
        request: record.request,
        status: record.status,
        updatedAt: record.updatedAt,
      });
    }

    if (statusForRecord(record) === "consent_required") {
      summary.status = "consent_required";
    } else if (summary.status !== "consent_required") {
      summary.status = statusForRecord(record);
    }

    summaries.set(connectorId, summary);
  }

  return [...summaries.values()]
    .map((summary) => ({
      id: summary.id,
      label: summary.label,
      status: summary.status,
      requestCount: summary.requestCount,
      latestRequestAt: summary.latestRequestAt,
      requestedCapabilities: [...summary.requestedCapabilities].sort(),
      recentRequests: summary.recentRequests,
      terminalCommand: "jasper apps",
    }))
    .sort(sortByMostRecent);
}

function mergeConnectorStates(records, connectorStates) {
  const summaries = new Map(
    summarizeConnectors(records).map((connector) => [connector.id, connector]),
  );

  for (const state of connectorStates) {
    const existing = summaries.get(state.id);
    summaries.set(state.id, {
      id: state.id,
      label: existing?.label || connectorLabel(state.id),
      status:
        state.status === "approved"
          ? "approved"
          : existing?.status || "tracked",
      consentStatus: state.status,
      approvedAt: state.approvedAt || null,
      revokedAt: state.revokedAt || null,
      latestRequestAt: existing?.latestRequestAt || null,
      requestCount: existing?.requestCount || 0,
      requestedCapabilities: existing?.requestedCapabilities || [],
      recentRequests: existing?.recentRequests || [],
      terminalCommand: "jasper apps",
    });
  }

  return [...summaries.values()]
    .map((connector) => ({
      ...connector,
      consentStatus:
        connector.consentStatus ||
        (connector.status === "approved" ? "approved" : "not_approved"),
      approvedAt: connector.approvedAt || null,
      revokedAt: connector.revokedAt || null,
    }))
    .sort(sortByMostRecent);
}

export function getJasperAppStatus(options = {}) {
  const acquisitionStore =
    options.acquisitionStore ||
    createToolAcquisitionStore({ jasperHome: options.jasperHome });
  const connectorStore =
    options.connectorStore ||
    createConnectorStore({ jasperHome: options.jasperHome });
  const records = acquisitionStore.listAcquisitions({
    limit: Number.MAX_SAFE_INTEGER,
  });
  const connectors = mergeConnectorStates(
    records,
    connectorStore.listConnectorStates(),
  );
  const pendingConnectors = connectors.filter(
    (connector) => connector.status === "consent_required",
  );

  const warnings = [];
  const nextSteps = [];
  if (pendingConnectors.length > 0) {
    warnings.push(
      `${pendingConnectors.length} connector request${pendingConnectors.length === 1 ? "" : "s"} ${pendingConnectors.length === 1 ? "is" : "are"} waiting on consent or setup.`,
    );
    nextSteps.push(
      "Run `jasper apps` to review which connectors Jasper is waiting on and which requests are blocked.",
    );
  }

  return {
    status: pendingConnectors.length > 0 ? "needs_attention" : "ready",
    summary:
      pendingConnectors.length > 0
        ? `Jasper is waiting on ${pendingConnectors.length} connector consent or setup path${pendingConnectors.length === 1 ? "" : "s"}.`
        : "No pending connector requests are blocking Jasper.",
    terminalCommand: "jasper apps",
    connectors,
    warnings,
    nextSteps,
  };
}

export function approveConnector(options = {}) {
  const connectorStore =
    options.connectorStore ||
    createConnectorStore({ jasperHome: options.jasperHome });
  const connectorId = normalizeText(options.connectorId);
  if (!connectorId) {
    throw new Error("Connector approval requires a connector id");
  }

  const state = connectorStore.approveConnector(connectorId, options.note);
  const memory =
    options.memory ||
    createEventStore({
      root: options.memoryRoot,
      jasperHome: options.jasperHome,
      source: "jasper-apps",
    });
  const event = memory.appendEvent({
    type: "connector.approved",
    source: "jasper-apps",
    tags: ["connector", "consent", "apps"],
    payload: {
      connectorId,
      approvedAt: state?.approvedAt || null,
      note: options.note ? String(options.note) : null,
    },
  });

  return {
    connector: state,
    event,
    apps: getJasperAppStatus({
      jasperHome: options.jasperHome,
      acquisitionStore: options.acquisitionStore,
      connectorStore,
    }),
  };
}

export function revokeConnector(options = {}) {
  const connectorStore =
    options.connectorStore ||
    createConnectorStore({ jasperHome: options.jasperHome });
  const connectorId = normalizeText(options.connectorId);
  if (!connectorId) {
    throw new Error("Connector revocation requires a connector id");
  }

  const state = connectorStore.revokeConnector(connectorId, options.note);
  const memory =
    options.memory ||
    createEventStore({
      root: options.memoryRoot,
      jasperHome: options.jasperHome,
      source: "jasper-apps",
    });
  const event = memory.appendEvent({
    type: "connector.revoked",
    source: "jasper-apps",
    tags: ["connector", "consent", "apps"],
    payload: {
      connectorId,
      revokedAt: state?.revokedAt || null,
      note: options.note ? String(options.note) : null,
    },
  });

  return {
    connector: state,
    event,
    apps: getJasperAppStatus({
      jasperHome: options.jasperHome,
      acquisitionStore: options.acquisitionStore,
      connectorStore,
    }),
  };
}

export function mergeDoctorStatus(setupStatus, appStatus) {
  const warnings = [
    ...(Array.isArray(setupStatus?.warnings) ? setupStatus.warnings : []),
    ...(Array.isArray(appStatus?.warnings) ? appStatus.warnings : []),
  ];
  const nextSteps = [
    ...(Array.isArray(setupStatus?.nextSteps) ? setupStatus.nextSteps : []),
    ...(Array.isArray(appStatus?.nextSteps) ? appStatus.nextSteps : []),
  ];

  return {
    ...setupStatus,
    status:
      setupStatus?.status === "needs_attention" ||
      appStatus?.status === "needs_attention"
        ? "needs_attention"
        : "ready",
    warnings,
    nextSteps,
    apps: appStatus,
  };
}
