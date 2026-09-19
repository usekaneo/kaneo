const text = { type: "string" };
const integer = { type: "integer" };
const choice = (...values) => ({ type: "string", enum: values });
const array = (items) => ({ type: "array", items });
const object = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
const citation = object({
  path: text,
  line: integer,
  quote: text,
  revision: choice("head", "base"),
});
const request = object({
  kind: choice("file", "symbol"),
  value: text,
  line: nullable(integer),
});
const behavior = {
  title: text,
  severity: choice("high", "medium"),
  trigger: text,
  expected: text,
  actual: text,
  introducedBy: text,
};
const schemas = {
  investigate: object({
    findings: array(
      object({
        id: text,
        ...behavior,
        category: choice("authorization", "data", "behavior", "ui"),
        path: text,
        line: integer,
        evidence: array(citation),
        contract: citation,
        disproofQueries: array(request),
      }),
    ),
    requests: array(request),
  }),
  verify: object({
    decisions: array(
      object({
        id: text,
        verdict: choice("keep", "reject", "uncertain"),
        reason: text,
        disproofChecked: text,
        finding: nullable(object(behavior)),
        evidence: array(citation),
        contract: nullable(citation),
      }),
    ),
  }),
  "base-behavior": object({
    checks: array(
      object({
        id: text,
        alreadyPresent: choice("yes", "no", "unknown"),
        reason: text,
        evidence: array(
          object({
            path: text,
            line: integer,
            quote: text,
            revision: choice("base"),
          }),
        ),
      }),
    ),
  }),
};

export function responseFormat(stage) {
  const name = stage === "investigate-context" ? "investigate" : stage;
  if (!Object.hasOwn(schemas, name)) throw new Error("Unknown review stage");
  return {
    type: "json_schema",
    json_schema: { name, strict: true, schema: schemas[name] },
  };
}

// Providers differ in enforcement. Check the same restricted schema locally.
export function matchesSchema(value, schema) {
  if (schema.anyOf)
    return schema.anyOf.some((item) => matchesSchema(value, item));
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === "null") return value === null;
  if (schema.type === "string") return typeof value === "string";
  if (schema.type === "integer") return Number.isSafeInteger(value);
  if (schema.type === "array")
    return (
      Array.isArray(value) &&
      value.every((item) => matchesSchema(item, schema.items))
    );
  if (schema.type === "object")
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      schema.required.every(
        (key) =>
          Object.hasOwn(value, key) &&
          matchesSchema(value[key], schema.properties[key]),
      ) &&
      Object.keys(value).every((key) => Object.hasOwn(schema.properties, key))
    );
  return false;
}

export function validateResponse(value, stage) {
  if (!matchesSchema(value, responseFormat(stage).json_schema.schema)) {
    const error = new Error(
      "Malformed model response; review is inconclusive.",
    );
    error.code = "INVALID_MODEL_RESPONSE";
    throw error;
  }
  return value;
}
