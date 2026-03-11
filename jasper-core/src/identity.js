import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultIdentityConfigPath } from "./home.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const coreRoot = path.resolve(__dirname, "..");

function countIndent(rawLine) {
  let count = 0;
  for (const char of rawLine) {
    if (char !== " ") {
      break;
    }
    count += 1;
  }
  return count;
}

function coerceScalar(value) {
  const trimmed = String(value || "").trim();
  if (trimmed === "") {
    return "";
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (/^-?\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
}

function parseSimpleYaml(sourceText) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = String(sourceText || "").split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const indent = countIndent(rawLine);
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (trimmed.startsWith("- ")) {
      if (!Array.isArray(parent.value)) {
        throw new Error(`Invalid YAML list indentation near: ${trimmed}`);
      }
      parent.value.push(coerceScalar(trimmed.slice(2)));
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex < 0) {
      throw new Error(`Invalid YAML line: ${trimmed}`);
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const remainder = trimmed.slice(separatorIndex + 1).trim();
    const nextLine = lines[index + 1] ?? "";
    const nextTrimmed = nextLine.trim();
    const nextIndent = nextTrimmed ? countIndent(nextLine) : -1;
    const expectsNestedBlock =
      remainder === "" && nextTrimmed && nextIndent > indent;

    let value;
    if (!expectsNestedBlock) {
      value = coerceScalar(remainder);
    } else if (nextTrimmed.startsWith("- ")) {
      value = [];
    } else {
      value = {};
    }

    if (Array.isArray(parent.value)) {
      throw new Error(
        `Cannot assign mapping key inside scalar list near: ${trimmed}`,
      );
    }

    parent.value[key] = value;
    if (expectsNestedBlock) {
      stack.push({ indent, value });
    }
  }

  return root;
}

function assertString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Identity field "${fieldName}" must be a non-empty string`);
  }
}

function assertStringList(value, fieldName) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string")
  ) {
    throw new Error(
      `Identity field "${fieldName}" must be a non-empty string array`,
    );
  }
}

export function bundledIdentityPath() {
  return path.join(coreRoot, "config", "identity.example.yaml");
}

export function defaultIdentityPath(options = {}) {
  const installedPath = defaultIdentityConfigPath(options);
  if (fs.existsSync(installedPath)) {
    return installedPath;
  }
  return bundledIdentityPath();
}

export function validateIdentityConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("Identity config must be an object");
  }

  const identity = config.identity || {};
  const personality = config.personality || {};

  assertString(identity.name, "identity.name");
  assertString(identity.owner, "identity.owner");
  assertString(identity.role, "identity.role");
  assertStringList(config.mission, "mission");
  assertString(personality.tone, "personality.tone");
  assertString(personality.style, "personality.style");
  assertStringList(personality.traits, "personality.traits");

  return {
    identity: {
      name: identity.name.trim(),
      owner: identity.owner.trim(),
      role: identity.role.trim(),
    },
    mission: config.mission.map((item) => item.trim()),
    personality: {
      tone: personality.tone.trim(),
      style: personality.style.trim(),
      traits: personality.traits.map((item) => item.trim()),
    },
  };
}

export function loadIdentityConfig(options = {}) {
  const identityPath = path.resolve(
    options.identityPath || defaultIdentityPath(options),
  );
  const sourceText = fs.readFileSync(identityPath, "utf8");
  const rawConfig = parseSimpleYaml(sourceText);
  const config = validateIdentityConfig(rawConfig);

  return {
    path: identityPath,
    loadedAt: new Date().toISOString(),
    config,
  };
}
