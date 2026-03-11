export class SessionListener {
  constructor(options = {}) {
    this.id = "listener.session";
    this.cwd = options.cwd || process.cwd();
    this.watchPaths = Array.isArray(options.watchPaths) ? options.watchPaths : [];
  }

  captureInitialObservations() {
    return [
      {
        type: "listener.session.snapshot",
        source: this.id,
        tags: ["listener", "session", "snapshot"],
        payload: {
          cwd: this.cwd,
          pid: process.pid,
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          watchPaths: this.watchPaths,
        },
      },
    ];
  }

  pollObservations() {
    return [];
  }
}

export function createSessionListener(options = {}) {
  return new SessionListener(options);
}
