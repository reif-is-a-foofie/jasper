import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function normalizeLimit(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(50, Math.floor(parsed));
}

function resolveEmailWindow(query) {
  const text = String(query || "").trim().toLowerCase();
  const now = new Date();

  if (text.includes("last week")) {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { label: "last_week", start, end: now };
  }

  if (text.includes("today")) {
    return {
      label: "today",
      start: new Date(now).setHours(0, 0, 0, 0),
      end: now,
    };
  }

  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  return {
    label: "recent",
    start,
    end: now,
  };
}

function buildMailboxListScript() {
  return `
const Mail = Application("Mail");
const mailboxes = [];
for (const account of Mail.accounts()) {
  for (const mailbox of account.mailboxes()) {
    const name = mailbox.name();
    if (!name) {
      continue;
    }
    const normalized = name.toLowerCase();
    if (!normalized.includes("inbox")) {
      continue;
    }
    mailboxes.push({
      account: account.name(),
      mailbox: name,
    });
  }
}
console.log(JSON.stringify(mailboxes));
`.trim();
}

function buildMailboxQueryScript(request, accountName, mailboxName) {
  return `
const Mail = Application("Mail");
const account = Mail.accounts.byName(${JSON.stringify(accountName)});
const mailbox = account.mailboxes.byName(${JSON.stringify(mailboxName)});
const startDate = new Date(${JSON.stringify(request.start)});
const endDate = new Date(${JSON.stringify(request.end)});
const limit = ${normalizeLimit(request.limit, 10)};
const results = [];
const messages = mailbox.messages;
for (let index = messages.length - 1; index >= 0; index -= 1) {
  if (results.length >= limit) {
    break;
  }
  const message = messages[index];
  const received = message.dateReceived();
  if (!received || received < startDate || received > endDate) {
    continue;
  }
  results.push({
    account: account.name(),
    mailbox: mailbox.name(),
    subject: message.subject() || "",
    sender: String(message.sender() || "").trim(),
    received: received.toISOString(),
    snippet: (message.content() || "").split("\\n").slice(0, 3).join(" ").trim(),
  });
}
console.log(JSON.stringify({
  source: "macos-mail",
  account: account.name(),
  mailbox: mailbox.name(),
  messages: results,
}));
`.trim();
}

async function runOsaScript(script, timeoutMs) {
  const result = await execFileAsync("osascript", ["-l", "JavaScript", "-e", script], {
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
  });
  return String(result.stdout || result.stderr || "").trim();
}

function parseJsonOutput(rawOutput) {
  const text = String(rawOutput || "").trim();
  if (!text) {
    throw new Error("Missing JSON output from Mail bridge.");
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates = [...lines].reverse();

  for (const candidate of candidates) {
    if (
      (candidate.startsWith("{") && candidate.endsWith("}")) ||
      (candidate.startsWith("[") && candidate.endsWith("]"))
    ) {
      return JSON.parse(candidate);
    }
  }

  return JSON.parse(text);
}

function formatRunnerError(error) {
  const stdout =
    error && typeof error === "object" && "stdout" in error
      ? String(error.stdout || "").trim()
      : "";
  const stderr =
    error && typeof error === "object" && "stderr" in error
      ? String(error.stderr || "").trim()
      : "";
  if (stdout || stderr) {
    return [stderr, stdout].filter(Boolean).join(" | ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error || "unknown");
}

function likelyUsefulMailbox(entry) {
  return entry && typeof entry === "object" && entry.mailbox && entry.account;
}

export async function runMacEmailQuery(request) {
  if (process.platform !== "darwin") {
    return {
      status: "unavailable",
      reason: "email-read requires macOS Mail access.",
      source: "macos-mail",
      messages: [],
    };
  }

  try {
    const rawMailboxes = await runOsaScript(buildMailboxListScript(), 6_000);
    const listedMailbox = parseJsonOutput(rawMailboxes);
    const inboxes = Array.isArray(listedMailbox)
      ? listedMailbox.filter(likelyUsefulMailbox)
      : [];
    const targetMailboxes = inboxes.slice(0, 5);
    const messages = [];
    const skipped = [];

    for (const entry of targetMailboxes) {
      try {
        const payload = parseJsonOutput(
          await runOsaScript(
            buildMailboxQueryScript(request, entry.account, entry.mailbox),
            5_000,
          ),
        );
        if (Array.isArray(payload.messages)) {
          messages.push(...payload.messages);
        }
      } catch (error) {
        skipped.push({
          mailbox: `${entry.account}/${entry.mailbox}`,
          error: formatRunnerError(error),
        });
      }
    }

    messages.sort((left, right) => right.received.localeCompare(left.received));
    return {
      status: "ready",
      source: "macos-mail",
      messages: messages.slice(0, normalizeLimit(request.limit, 10)),
      skippedMailboxes: skipped,
    };
  } catch (error) {
    return {
      status: "error",
      source: "macos-mail",
      reason: formatRunnerError(error),
      messages: [],
    };
  }
}

export function createEmailReadTool(context) {
  return {
    id: "email-read",
    description: "Read recent Mail.app messages once the email connector is active.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    async run(input = {}) {
      const query = String(input.query || "").trim();
      const window = resolveEmailWindow(query);
      const runner = context.emailReadRunner || runMacEmailQuery;
      const result = await runner({
        start: window.start,
        end: window.end,
        limit: normalizeLimit(input.limit, 5),
      });

      return {
        ...result,
        query,
        window: {
          label: window.label,
          start: window.start.toISOString ? window.start.toISOString() : window.start,
          end: window.end.toISOString ? window.end.toISOString() : window.end,
        },
      };
    },
  };
}

export { resolveEmailWindow };
