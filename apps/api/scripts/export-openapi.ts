import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createApp } from "../src/index";

const { app } = createApp();
const response = await app.request("/api/openapi");

if (!response.ok) {
  throw new Error(`OpenAPI export failed with status ${response.status}`);
}

const spec = await response.json();
// Defaults to the file the docs site reads; the drift check passes a temp path.
const outputPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(import.meta.dirname, "../../docs/openapi.json");
await writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`);
