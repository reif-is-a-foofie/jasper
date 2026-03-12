#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootCandidates = [
  path.resolve(__dirname, "..", ".."),
  path.resolve(__dirname, ".."),
];
const repoRoot =
  rootCandidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "jasper-agent", "src", "cli.js")),
  ) ?? rootCandidates[0];
const agentCliPath = path.join(repoRoot, "jasper-agent", "src", "cli.js");
const localCodexBin = path.join(
  repoRoot,
  "codex-rs",
  "target",
  "debug",
  "codex",
);
const packagedVendorRoots = [
  path.join(repoRoot, "vendor"),
  path.join(repoRoot, "codex-cli", "vendor"),
];

function resolveTargetTriple() {
  const { platform, arch } = process;

  switch (platform) {
    case "linux":
    case "android":
      if (arch === "x64") {
        return "x86_64-unknown-linux-musl";
      }
      if (arch === "arm64") {
        return "aarch64-unknown-linux-musl";
      }
      break;
    case "darwin":
      if (arch === "x64") {
        return "x86_64-apple-darwin";
      }
      if (arch === "arm64") {
        return "aarch64-apple-darwin";
      }
      break;
    case "win32":
      if (arch === "x64") {
        return "x86_64-pc-windows-msvc";
      }
      if (arch === "arm64") {
        return "aarch64-pc-windows-msvc";
      }
      break;
    default:
      break;
  }

  return null;
}

function prependPath(entries, currentPath) {
  const delimiter = process.platform === "win32" ? ";" : ":";
  const existing = (currentPath || "").split(delimiter).filter(Boolean);
  return [...entries, ...existing].join(delimiter);
}

function resolvePackagedCodex() {
  const targetTriple = resolveTargetTriple();
  if (!targetTriple) {
    return null;
  }

  const codexBinaryName = process.platform === "win32" ? "codex.exe" : "codex";

  for (const vendorRoot of packagedVendorRoots) {
    const binaryPath = path.join(
      vendorRoot,
      targetTriple,
      "codex",
      codexBinaryName,
    );
    if (!fs.existsSync(binaryPath)) {
      continue;
    }

    const pathDir = path.join(vendorRoot, targetTriple, "path");
    const extraPathEntries = fs.existsSync(pathDir) ? [pathDir] : [];

    return {
      command: binaryPath,
      args: [],
      env: extraPathEntries.length
        ? { PATH: prependPath(extraPathEntries, process.env.PATH) }
        : {},
    };
  }

  return null;
}

function printBanner() {
  if (!process.stdout.isTTY) {
    return;
  }

  const cyan = "\u001b[36m";
  const dim = "\u001b[2m";
  const reset = "\u001b[0m";
  const lines = [
    `${cyan}      _                           ${reset}`,
    `${cyan}     | | __ _ ___ _ __   ___ _ __ ${reset}`,
    `${cyan}  _  | |/ _\` / __| '_ \\/ _ \\ '__|${reset}`,
    `${cyan} | |_| | (_| \\__ \\ |_) |  __/ |   ${reset}`,
    `${cyan}  \\___/ \\__,_|___/ .__/ \\___|_|   ${reset}`,
    `${cyan}                  |_|             ${reset}`,
    `${dim}Welcome, I am Jasper.${reset}`,
    `${dim}Household intelligence layered onto Codex.${reset}`,
    "",
  ];

  process.stdout.write(`${lines.join("\n")}\n`);
}

function spawnProcess(command, commandArgs, env) {
  return spawn(command, commandArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    env,
  });
}

function resolveCodexCommand() {
  if (process.env.JASPER_CODEX_BIN) {
    return {
      command: process.env.JASPER_CODEX_BIN,
      args: [],
      env: {},
    };
  }

  const packagedCodex = resolvePackagedCodex();
  if (packagedCodex) {
    return packagedCodex;
  }

  if (fs.existsSync(localCodexBin)) {
    return {
      command: localCodexBin,
      args: [],
      env: {},
    };
  }

  return {
    command: "cargo",
    args: [
      "run",
      "--manifest-path",
      "codex-rs/Cargo.toml",
      "--bin",
      "codex",
      "--",
    ],
    env: {},
  };
}

const [, , ...args] = process.argv;
const subcommand = args[0] || "";

let child;
if (subcommand === "runtime") {
  child = spawnProcess(
    process.execPath,
    [agentCliPath, "start", ...args.slice(1)],
    process.env,
  );
} else if (subcommand === "identity") {
  child = spawnProcess(
    process.execPath,
    [agentCliPath, "identity", ...args.slice(1)],
    process.env,
  );
} else if (subcommand === "memory") {
  child = spawnProcess(
    process.execPath,
    [agentCliPath, "memory", ...args.slice(1)],
    process.env,
  );
} else if (subcommand === "tools") {
  child = spawnProcess(
    process.execPath,
    [agentCliPath, "tools", ...args.slice(1)],
    process.env,
  );
} else if (subcommand === "dream") {
  child = spawnProcess(
    process.execPath,
    [agentCliPath, "dream", ...args.slice(1)],
    process.env,
  );
} else if (subcommand === "setup") {
  child = spawnProcess(
    process.execPath,
    [agentCliPath, "setup", ...args.slice(1)],
    process.env,
  );
} else {
  if (args.length === 0) {
    printBanner();
  }

  const codex = resolveCodexCommand();
  child = spawnProcess(codex.command, [...codex.args, ...args], {
    ...process.env,
    ...codex.env,
    JASPER_BRANDED: "1",
  });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  process.stderr.write(`jasper launcher error: ${error.message}\n`);
  process.exit(1);
});
