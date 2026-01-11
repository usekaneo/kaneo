import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OPENAPI_URL =
  process.env.OPENAPI_URL || "https://cloud.kaneo.app/api/openapi";
const OUTPUT_PATH = resolve(__dirname, "../openapi.json");

async function fetchOpenAPISpec() {
  try {
    console.log(`Fetching OpenAPI spec from ${OPENAPI_URL}...`);

    const response = await fetch(OPENAPI_URL);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`,
      );
    }

    const spec = await response.json();

    // Write the spec to openapi.json
    writeFileSync(OUTPUT_PATH, JSON.stringify(spec, null, 2), "utf-8");

    console.log(`✓ OpenAPI spec successfully saved to ${OUTPUT_PATH}`);
    console.log(`  Spec version: ${spec.info?.version || "unknown"}`);
    console.log(`  Endpoints: ${Object.keys(spec.paths || {}).length}`);
  } catch (error) {
    console.error("Failed to fetch OpenAPI spec:", error);
    process.exit(1);
  }
}

fetchOpenAPISpec();
