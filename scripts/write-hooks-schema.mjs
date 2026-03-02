import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";

import { generatedHookSchemas } from "../codex-rs/hooks/schema/schemas.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const generatedDir = path.resolve(__dirname, "../codex-rs/hooks/schema/generated");

await fs.mkdir(generatedDir, { recursive: true });

for (const { name, schema } of generatedHookSchemas) {
  const jsonSchema = zodToJsonSchema(schema, {
    name,
    target: "jsonSchema7",
    $refStrategy: "none",
  });
  const outputPath = path.join(generatedDir, `${name}.schema.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(jsonSchema, null, 2)}\n`);
}
