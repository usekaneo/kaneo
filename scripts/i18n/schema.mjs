import {
  loadLocales,
  PLURAL_CATEGORIES,
  schemaPath,
  writeJson,
} from "./shared.mjs";

// A locale supplies the plural categories its own language needs, which is not
// the set en-US happens to use: Russian adds _few and _many, Chinese omits
// _one, and i18next allows a _zero override anywhere. So every plural form of a
// known key is accepted, and no plural form is demanded.
const { reference } = await loadLocales();

const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://kaneo.app/i18n/schema.json",
  title: "Kaneo locale schema",
  type: "object",
  additionalProperties: false,
  properties: buildProperties(reference.data),
  required: requiredKeys(reference.data),
};

await writeJson(schemaPath, schema);
console.log(`Wrote ${schemaPath}`);

function pluralBase(key) {
  for (const category of PLURAL_CATEGORIES) {
    const suffix = `_${category}`;
    if (key.endsWith(suffix)) {
      return key.slice(0, -suffix.length);
    }
  }
  return null;
}

function requiredKeys(value) {
  return Object.keys(value).filter((key) => {
    // _zero is an exact-count override the reference can declare, and check.mjs
    // requires it, so it stays required even when it interpolates a count.
    if (key.endsWith("_zero")) {
      return true;
    }
    if (pluralBase(key)) {
      return false;
    }
    // A count-bearing key may be represented purely by plural variants.
    const child = value[key];
    return !(typeof child === "string" && child.includes("{{count}}"));
  });
}

function buildProperties(value) {
  const properties = {};

  for (const [key, child] of Object.entries(value)) {
    properties[key] = buildSchemaNode(child);

    if (typeof child !== "string") {
      continue;
    }

    // Only a key that is already pluralised, or one interpolating a count, can
    // legitimately gain a locale-specific plural form.
    const base = pluralBase(key);
    if (!base && !child.includes("{{count}}")) {
      continue;
    }

    for (const category of PLURAL_CATEGORIES) {
      const variant = `${base ?? key}_${category}`;
      if (!(variant in properties)) {
        properties[variant] = { type: "string" };
      }
    }
  }

  return properties;
}

function buildSchemaNode(value) {
  if (typeof value === "string") {
    return { type: "string" };
  }

  return {
    type: "object",
    additionalProperties: false,
    properties: buildProperties(value),
    required: requiredKeys(value),
  };
}
