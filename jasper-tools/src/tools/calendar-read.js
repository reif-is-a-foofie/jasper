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

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export function resolveCalendarWindow(query) {
  const text = String(query || "").trim().toLowerCase();
  const now = new Date();

  if (text.includes("next week")) {
    const start = startOfDay(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);
    return {
      label: "next_week",
      start,
      end,
    };
  }

  if (text.includes("today")) {
    return {
      label: "today",
      start: startOfDay(now),
      end: endOfDay(now),
    };
  }

  if (text.includes("tomorrow")) {
    const start = startOfDay(now);
    start.setDate(start.getDate() + 1);
    return {
      label: "tomorrow",
      start,
      end: endOfDay(start),
    };
  }

  const start = new Date(now);
  const end = new Date(now);
  end.setDate(end.getDate() + 1);
  return {
    label: "upcoming_24h",
    start,
    end,
  };
}

function buildCalendarListScript() {
  return `
const Calendar = Application("Calendar");
console.log(JSON.stringify(Calendar.calendars().map((calendar) => calendar.name())));
`.trim();
}

function buildCalendarEventsScript(request, calendarName) {
  const startIso = request.start.toISOString();
  const endIso = request.end.toISOString();

  return `
const Calendar = Application("Calendar");
const calendar = Calendar.calendars.byName(${JSON.stringify(calendarName)});
const startDate = new Date(${JSON.stringify(startIso)});
const endDate = new Date(${JSON.stringify(endIso)});

const results = [];
const events = calendar.events.whose({
  startDate: { _greaterThan: startDate },
  endDate: { _lessThanEquals: endDate },
});

for (let index = 0; index < events.length; index += 1) {
  const event = events[index];
  const eventStart = event.startDate();
  results.push({
    calendar: calendar.name(),
    title: event.summary(),
    start: eventStart.toISOString(),
    end: event.endDate().toISOString(),
    location: event.location() || null,
    uid: event.uid(),
  });
}

console.log(JSON.stringify({
  source: "macos-calendar",
  calendar: calendar.name(),
  events: results,
}));
`.trim();
}

async function runOsaScript(script, timeoutMs) {
  const result = await execFileAsync(
    "osascript",
    ["-l", "JavaScript", "-e", script],
    {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    },
  );
  return String(result.stdout || result.stderr || "").trim();
}

function parseJsonOutput(rawOutput) {
  const text = String(rawOutput || "").trim();
  if (!text) {
    throw new Error("Missing JSON output from Calendar bridge.");
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
  if (stderr || stdout) {
    return [stderr, stdout].filter(Boolean).join(" | ");
  }

  if (error && typeof error === "object" && "killed" in error && error.killed) {
    return "Timed out while querying this calendar.";
  }

  if (error instanceof Error && error.message.startsWith("Command failed:")) {
    return "Calendar command failed.";
  }

  return error instanceof Error ? error.message : String(error || "unknown");
}

function likelyUsefulCalendarName(name) {
  return !/holiday|birthdays|reminders|siri suggestion/i.test(
    String(name || ""),
  );
}

export async function runMacCalendarQuery(request) {
  if (process.platform !== "darwin") {
    return {
      status: "unavailable",
      reason: "calendar-read currently requires macOS Calendar access.",
      source: "macos-calendar",
      events: [],
    };
  }

  try {
    const rawCalendarNames = await runOsaScript(buildCalendarListScript(), 8_000);
    const listedNames = parseJsonOutput(rawCalendarNames);
    const calendarNames = listedNames.filter(likelyUsefulCalendarName);
    const targetCalendars =
      calendarNames.length > 0 ? calendarNames : listedNames.slice(0, 5);
    const events = [];
    const skippedCalendars = [];

    for (const calendarName of targetCalendars.slice(0, 8)) {
      try {
        const payload = parseJsonOutput(
          await runOsaScript(
            buildCalendarEventsScript(request, calendarName),
            5_000,
          ),
        );
        events.push(...(Array.isArray(payload.events) ? payload.events : []));
      } catch (error) {
        skippedCalendars.push({
          calendar: calendarName,
          error: formatRunnerError(error),
        });
      }
    }

    events.sort((left, right) => left.start.localeCompare(right.start));
    return {
      status: "ready",
      source: "macos-calendar",
      events: events.slice(0, normalizeLimit(request.limit, 10)),
      skippedCalendars,
    };
  } catch (error) {
    const message = formatRunnerError(error);
    const accessDenied =
      message.includes("-1743") ||
      message.toLowerCase().includes("not authorized") ||
      message.toLowerCase().includes("not permitted");
    const timedOut =
      message.toLowerCase().includes("timed out") ||
      (error && typeof error === "object" && "killed" in error && Boolean(error.killed));

    return {
      status: "error",
      source: "macos-calendar",
      reason: accessDenied
        ? "Calendar access is blocked. Grant Calendar access to Jasper or the terminal and try again."
        : timedOut
          ? "Calendar access timed out. Jasper skipped one or more calendars."
          : "Calendar read failed.",
      error: message,
      events: [],
    };
  }
}

export function createCalendarReadTool(context) {
  return {
    id: "calendar-read",
    description: "Read upcoming events from the local macOS Calendar app.",
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
      const window = resolveCalendarWindow(query);
      const runner = context.calendarReadRunner || runMacCalendarQuery;
      const result = await runner({
        ...window,
        limit: normalizeLimit(input.limit, 10),
      });

      return {
        ...result,
        query,
        window: {
          label: window.label,
          start: window.start.toISOString(),
          end: window.end.toISOString(),
        },
      };
    },
  };
}
