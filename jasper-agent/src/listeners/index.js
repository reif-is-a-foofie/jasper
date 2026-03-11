import { createFilesystemListener } from "./filesystem-listener.js";
import { createSessionListener } from "./session-listener.js";

function normalizeWatchPaths(paths) {
  if (Array.isArray(paths) && paths.length > 0) {
    return paths;
  }
  return [process.cwd()];
}

export function createEnvironmentListeners(options = {}) {
  const watchPaths = normalizeWatchPaths(options.watchPaths);

  return [
    createSessionListener({
      cwd: options.cwd || process.cwd(),
      watchPaths,
    }),
    createFilesystemListener({
      watchPaths,
      maxDepth: options.maxDepth,
      maxFiles: options.maxFiles,
      maxChanges: options.maxChanges,
      maxRecentFiles: options.maxRecentFiles,
    }),
  ];
}
