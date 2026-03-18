import fs from "node:fs";
import path from "node:path";
import { ensureJasperHomeLayout } from "../../jasper-core/src/home.js";

function appendJsonLine(filePath, value) {
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function normalizeConnectorId(value) {
  return String(value || "").trim().toLowerCase();
}

function connectorsLayout(options = {}) {
  const home = ensureJasperHomeLayout({ jasperHome: options.jasperHome });
  const connectorsDir = path.join(home.dataDir, "connectors");
  fs.mkdirSync(connectorsDir, { recursive: true });
  return {
    root: connectorsDir,
    approvalsLogPath: path.join(connectorsDir, "approvals.jsonl"),
  };
}

function applyConnectorEvent(states, event) {
  const connectorId = normalizeConnectorId(event.connectorId);
  if (!connectorId) {
    return;
  }

  const current =
    states.get(connectorId) || {
      id: connectorId,
      status: "unknown",
      firstApprovedAt: null,
      approvedAt: null,
      revokedAt: null,
      updatedAt: null,
      note: null,
    };

  if (event.action === "connector_approved") {
    const approvedAt = String(event.ts || "").trim() || null;
    states.set(connectorId, {
      ...current,
      id: connectorId,
      status: "approved",
      firstApprovedAt: current.firstApprovedAt || approvedAt,
      approvedAt,
      updatedAt: approvedAt,
      note: event.note ? String(event.note) : null,
    });
    return;
  }

  if (event.action === "connector_revoked") {
    const revokedAt = String(event.ts || "").trim() || null;
    states.set(connectorId, {
      ...current,
      id: connectorId,
      status: "revoked",
      revokedAt,
      updatedAt: revokedAt,
      note: event.note ? String(event.note) : null,
    });
  }
}

export class JasperConnectorStore {
  constructor(options = {}) {
    this.layout = connectorsLayout(options);
  }

  listConnectorStates() {
    const states = new Map();
    for (const event of readJsonLines(this.layout.approvalsLogPath)) {
      applyConnectorEvent(states, event);
    }

    return [...states.values()].sort((left, right) =>
      String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")),
    );
  }

  getConnectorState(connectorId) {
    const normalized = normalizeConnectorId(connectorId);
    if (!normalized) {
      return null;
    }

    return (
      this.listConnectorStates().find((state) => state.id === normalized) || null
    );
  }

  listApprovedConnectors() {
    return this.listConnectorStates().filter(
      (state) => state.status === "approved",
    );
  }

  approveConnector(connectorId, note = null) {
    const normalized = normalizeConnectorId(connectorId);
    if (!normalized) {
      throw new Error("Connector approval requires a connector id");
    }

    const ts = new Date().toISOString();
    appendJsonLine(this.layout.approvalsLogPath, {
      schemaVersion: 1,
      action: "connector_approved",
      ts,
      connectorId: normalized,
      note: note ? String(note) : null,
    });
    return this.getConnectorState(normalized);
  }

  revokeConnector(connectorId, note = null) {
    const normalized = normalizeConnectorId(connectorId);
    if (!normalized) {
      throw new Error("Connector revocation requires a connector id");
    }

    const ts = new Date().toISOString();
    appendJsonLine(this.layout.approvalsLogPath, {
      schemaVersion: 1,
      action: "connector_revoked",
      ts,
      connectorId: normalized,
      note: note ? String(note) : null,
    });
    return this.getConnectorState(normalized);
  }
}

export function createConnectorStore(options = {}) {
  return new JasperConnectorStore(options);
}
