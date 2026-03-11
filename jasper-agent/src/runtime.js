import { loadIdentityConfig } from "../../jasper-core/src/identity.js";

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class JasperRuntime {
  constructor(options = {}) {
    this.identityPath = options.identityPath;
    this.tickIntervalMs = Math.max(10, Number(options.tickIntervalMs ?? 5000));
    this.maxTicks =
      options.maxTicks === undefined ? null : Math.max(1, Number(options.maxTicks));
    this.stdout = options.stdout || process.stdout;
    this.identity = null;
    this.running = false;
    this.tickCount = 0;
  }

  log(event, details = {}) {
    const payload = {
      ts: nowIso(),
      event,
      ...details,
    };
    this.stdout.write(`${JSON.stringify(payload)}\n`);
  }

  initialize(options = {}) {
    const identityState = loadIdentityConfig({
      identityPath: this.identityPath,
    });
    this.identity = identityState;
    if (options.silent !== true) {
      this.log("runtime.initialized", {
        identityPath: identityState.path,
        agentName: identityState.config.identity.name,
        owner: identityState.config.identity.owner,
      });
    }
  }

  async start() {
    if (this.running) {
      throw new Error("Jasper runtime is already running");
    }

    this.initialize();
    this.running = true;
    this.log("runtime.started", {
      tickIntervalMs: this.tickIntervalMs,
      mode: this.maxTicks === null ? "continuous" : "bounded",
    });

    while (this.running) {
      this.tickCount += 1;
      this.log("runtime.tick", {
        tick: this.tickCount,
        role: this.identity.config.identity.role,
        mission: this.identity.config.mission,
      });

      if (this.maxTicks !== null && this.tickCount >= this.maxTicks) {
        this.stop("max_ticks_reached");
        break;
      }

      await sleep(this.tickIntervalMs);
    }

    return {
      ok: true,
      ticks: this.tickCount,
      stopped: !this.running,
    };
  }

  stop(reason = "requested") {
    if (!this.running) {
      return;
    }
    this.running = false;
    this.log("runtime.stopped", {
      reason,
      ticks: this.tickCount,
    });
  }
}

export function createJasperRuntime(options = {}) {
  return new JasperRuntime(options);
}
