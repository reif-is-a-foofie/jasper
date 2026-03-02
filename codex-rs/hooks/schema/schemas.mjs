import { z } from "zod";

const permissionModeSchema = z.enum([
  "default",
  "acceptEdits",
  "plan",
  "dontAsk",
  "bypassPermissions",
]);

const universalOutputSchema = z
  .object({
    continue: z.boolean().optional(),
    stopReason: z.string().optional(),
    suppressOutput: z.boolean().optional(),
    systemMessage: z.string().optional(),
  })
  .strict();

const sessionStartSpecificOutputSchema = z
  .object({
    hookEventName: z.literal("SessionStart"),
    additionalContext: z.string().optional(),
  })
  .strict();

export const sessionStartCommandInputSchema = z
  .object({
    session_id: z.string(),
    transcript_path: z.string().nullable(),
    cwd: z.string(),
    hook_event_name: z.literal("SessionStart"),
    model: z.string(),
    permission_mode: permissionModeSchema,
    source: z.enum(["startup", "resume", "clear"]),
  })
  .strict();

export const sessionStartCommandOutputSchema = universalOutputSchema
  .extend({
    hookSpecificOutput: sessionStartSpecificOutputSchema.optional(),
  })
  .strict();

export const stopCommandInputSchema = z
  .object({
    session_id: z.string(),
    transcript_path: z.string().nullable(),
    cwd: z.string(),
    hook_event_name: z.literal("Stop"),
    model: z.string(),
    permission_mode: permissionModeSchema,
    stop_hook_active: z.boolean(),
    last_assistant_message: z.string().nullable(),
  })
  .strict();

export const stopCommandOutputSchema = universalOutputSchema
  .extend({
    decision: z.enum(["block"]).optional(),
    reason: z.string().optional(),
  })
  .strict();

export const generatedHookSchemas = [
  {
    name: "session-start.command.input",
    schema: sessionStartCommandInputSchema,
  },
  {
    name: "session-start.command.output",
    schema: sessionStartCommandOutputSchema,
  },
  {
    name: "stop.command.input",
    schema: stopCommandInputSchema,
  },
  {
    name: "stop.command.output",
    schema: stopCommandOutputSchema,
  },
];
