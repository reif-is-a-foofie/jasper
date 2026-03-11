import fs from "node:fs";
import path from "node:path";

const DEFAULT_IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "target",
  "dist",
  "build",
  ".next",
]);

function normalizeLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizePaths(paths) {
  const input = Array.isArray(paths) ? paths : [];
  const normalized = input
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));

  return [...new Set(normalized)];
}

function shouldIgnoreDir(name, ignoredDirs) {
  return ignoredDirs.has(name);
}

function collectFiles(rootPath, options = {}, state = { depth: 0, items: [] }) {
  const maxDepth = normalizeLimit(options.maxDepth, 4);
  const maxFiles = normalizeLimit(options.maxFiles, 500);
  const ignoredDirs = options.ignoredDirs || DEFAULT_IGNORED_DIRS;

  if (!fs.existsSync(rootPath) || state.items.length >= maxFiles) {
    return state.items;
  }

  const stat = fs.statSync(rootPath);
  if (!stat.isDirectory()) {
    state.items.push({
      path: rootPath,
      size: stat.size,
      modifiedAt: new Date(stat.mtimeMs).toISOString(),
      mtimeMs: stat.mtimeMs,
    });
    return state.items;
  }

  if (state.depth > maxDepth) {
    return state.items;
  }

  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    if (state.items.length >= maxFiles) {
      break;
    }

    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      if (shouldIgnoreDir(entry.name, ignoredDirs)) {
        continue;
      }
      collectFiles(
        fullPath,
        options,
        {
          depth: state.depth + 1,
          items: state.items,
        },
      );
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileStat = fs.statSync(fullPath);
    state.items.push({
      path: fullPath,
      size: fileStat.size,
      modifiedAt: new Date(fileStat.mtimeMs).toISOString(),
      mtimeMs: fileStat.mtimeMs,
    });
  }

  return state.items;
}

function buildSnapshotMap(entries) {
  return new Map(
    entries.map((entry) => [
      entry.path,
      {
        size: entry.size,
        modifiedAt: entry.modifiedAt,
        mtimeMs: entry.mtimeMs,
      },
    ]),
  );
}

function diffSnapshots(previousSnapshot, nextSnapshot) {
  const changes = [];

  for (const [filePath, nextValue] of nextSnapshot.entries()) {
    const previousValue = previousSnapshot.get(filePath);
    if (!previousValue) {
      changes.push({
        kind: "added",
        path: filePath,
        size: nextValue.size,
        modifiedAt: nextValue.modifiedAt,
      });
      continue;
    }

    if (previousValue.mtimeMs !== nextValue.mtimeMs || previousValue.size !== nextValue.size) {
      changes.push({
        kind: "modified",
        path: filePath,
        size: nextValue.size,
        modifiedAt: nextValue.modifiedAt,
      });
    }
  }

  for (const [filePath, previousValue] of previousSnapshot.entries()) {
    if (nextSnapshot.has(filePath)) {
      continue;
    }
    changes.push({
      kind: "deleted",
      path: filePath,
      size: previousValue.size,
      modifiedAt: previousValue.modifiedAt,
    });
  }

  return changes;
}

export class FilesystemListener {
  constructor(options = {}) {
    this.id = "listener.filesystem";
    this.watchPaths = normalizePaths(options.watchPaths);
    this.maxDepth = normalizeLimit(options.maxDepth, 4);
    this.maxFiles = normalizeLimit(options.maxFiles, 500);
    this.maxChanges = normalizeLimit(options.maxChanges, 20);
    this.maxRecentFiles = normalizeLimit(options.maxRecentFiles, 10);
    this.previousSnapshots = new Map();
  }

  scanRoot(rootPath) {
    return collectFiles(rootPath, {
      maxDepth: this.maxDepth,
      maxFiles: this.maxFiles,
    });
  }

  captureInitialObservations() {
    const events = [];

    for (const rootPath of this.watchPaths) {
      const entries = this.scanRoot(rootPath);
      const snapshot = buildSnapshotMap(entries);
      this.previousSnapshots.set(rootPath, snapshot);

      const recentFiles = [...entries]
        .sort((left, right) => right.mtimeMs - left.mtimeMs)
        .slice(0, this.maxRecentFiles)
        .map((entry) => ({
          path: entry.path,
          size: entry.size,
          modifiedAt: entry.modifiedAt,
        }));

      events.push({
        type: "listener.filesystem.snapshot",
        source: this.id,
        tags: ["listener", "filesystem", "snapshot"],
        payload: {
          rootPath,
          observedFileCount: entries.length,
          recentFiles,
        },
      });
    }

    return events;
  }

  pollObservations() {
    const events = [];

    for (const rootPath of this.watchPaths) {
      const previousSnapshot = this.previousSnapshots.get(rootPath) || new Map();
      const nextEntries = this.scanRoot(rootPath);
      const nextSnapshot = buildSnapshotMap(nextEntries);
      const changes = diffSnapshots(previousSnapshot, nextSnapshot).slice(0, this.maxChanges);
      this.previousSnapshots.set(rootPath, nextSnapshot);

      if (changes.length === 0) {
        continue;
      }

      events.push({
        type: "listener.filesystem.changed",
        source: this.id,
        tags: ["listener", "filesystem", "change"],
        payload: {
          rootPath,
          changeCount: changes.length,
          changes,
        },
      });
    }

    return events;
  }
}

export function createFilesystemListener(options = {}) {
  return new FilesystemListener(options);
}
