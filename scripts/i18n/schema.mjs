import { loadLocales, schemaPath, writeJson } from "./shared.mjs";

const { reference } = await loadLocales();

const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://kaneo.app/i18n/schema.json",
  title: "Kaneo locale schema",
  type: "object",
  additionalProperties: false,
  properties: buildProperties(reference.data),
  required: Object.keys(reference.data),
};

await writeJson(schemaPath, schema);
console.log(`Wrote ${schemaPath}`);

function buildProperties(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, buildSchemaNode(child)]),
  );
}

function buildSchemaNode(value) {
  if (typeof value === "string") {
    return { type: "string" };
  }

  return {
    type: "object",
    additionalProperties: false,
    properties: buildProperties(value),
    required: Object.keys(value),
  };
}
