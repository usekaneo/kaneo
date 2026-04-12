const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "patch",
  "head",
  "options",
  "trace",
] as const;

const wordCapitalize = (value: string): string =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const toWords = (value: string): string[] =>
  value
    .replace(/[{}]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

const toCamelCase = (parts: string[]): string =>
  parts
    .map((part, index) => (index === 0 ? part : wordCapitalize(part)))
    .join("");

const toTitleCase = (parts: string[]): string =>
  parts.map((part) => wordCapitalize(part)).join(" ");

const splitCamelCase = (value: string): string[] =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const summarizeAction = (action: string): string => {
  if (action === "has") {
    return "check";
  }
  return action;
};

export const normalizeApiServerUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

export const normalizeOrganizationAuthOperations = (
  authSpec: Record<string, unknown>,
): Record<string, unknown> => {
  const normalized = JSON.parse(JSON.stringify(authSpec)) as Record<
    string,
    unknown
  >;
  const paths = ((normalized as { paths?: unknown }).paths || {}) as Record<
    string,
    unknown
  >;
  const organizationPaths = Object.fromEntries(
    Object.entries(paths)
      .filter(
        ([path]) =>
          path.startsWith("/organization") ||
          path.startsWith("/auth/organization"),
      )
      .map(([path, pathItem]) => [
        path.startsWith("/auth/") ? path : `/auth${path}`,
        pathItem,
      ]),
  ) as Record<string, unknown>;

  for (const [path, pathItem] of Object.entries(organizationPaths)) {
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }

    const endpointWords = toWords(
      path.replace(/^\/(?:auth\/)?organization\/?/, ""),
    );
    const action = endpointWords[0] || "get";
    const rest = endpointWords.slice(1);
    const opIdBaseParts = [action, "organization", ...rest];
    const summaryVerb = summarizeAction(action);
    const summaryObjectParts = ["organization", ...rest];

    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as
        | Record<string, unknown>
        | undefined;
      if (!operation || typeof operation !== "object") {
        continue;
      }

      operation.operationId = toCamelCase(opIdBaseParts);
      operation.summary = `${wordCapitalize(summaryVerb)} ${toTitleCase(
        summaryObjectParts,
      )}`.trim();
      operation.tags = ["Organization Management"];
    }
  }

  const normalizedWithOnlyOrganizationPaths = {
    ...normalized,
    paths: organizationPaths,
    tags: [
      {
        name: "Organization Management",
      },
    ],
  } as Record<string, unknown>;

  const refPattern = /^#\/components\/([^/]+)\/([^/]+)$/;
  const refs = new Set<string>();
  const scanRefs = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        scanRefs(entry);
      }
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }

    for (const [key, next] of Object.entries(value)) {
      if (key === "$ref" && typeof next === "string") {
        refs.add(next);
      } else {
        scanRefs(next);
      }
    }
  };

  scanRefs(
    (
      normalizedWithOnlyOrganizationPaths as {
        paths?: unknown;
        security?: unknown;
      }
    ).paths,
  );
  scanRefs(
    (
      normalizedWithOnlyOrganizationPaths as {
        paths?: unknown;
        security?: unknown;
      }
    ).security,
  );

  const sourceComponents = ((normalized as { components?: unknown })
    .components || {}) as Record<string, unknown>;
  const prunedComponents: Record<string, unknown> = {};

  if (
    sourceComponents.securitySchemes &&
    typeof sourceComponents.securitySchemes === "object"
  ) {
    prunedComponents.securitySchemes = sourceComponents.securitySchemes;
  }

  let changed = true;
  while (changed) {
    changed = false;
    const pendingRefs = [...refs];
    for (const ref of pendingRefs) {
      const match = refPattern.exec(ref);
      if (!match) {
        continue;
      }
      const section = match[1];
      const name = match[2];
      if (!section || !name) {
        continue;
      }
      const sourceSection = sourceComponents[section] as
        | Record<string, unknown>
        | undefined;
      if (!sourceSection || !(name in sourceSection)) {
        continue;
      }

      if (!(section in prunedComponents)) {
        prunedComponents[section] = {};
      }
      const targetSection = prunedComponents[section] as Record<
        string,
        unknown
      >;
      if (name in targetSection) {
        continue;
      }

      targetSection[name] = sourceSection[name];
      const before = refs.size;
      scanRefs(sourceSection[name]);
      if (refs.size > before) {
        changed = true;
      }
    }
  }

  if (Object.keys(prunedComponents).length > 0) {
    normalizedWithOnlyOrganizationPaths.components = prunedComponents;
  } else {
    delete normalizedWithOnlyOrganizationPaths.components;
  }

  return normalizedWithOnlyOrganizationPaths;
};

export const mergeOpenApiSpecs = (
  honoSpec: Record<string, unknown>,
  authSpec: Record<string, unknown>,
) => {
  const mergeRecord = (a: unknown, b: unknown): Record<string, unknown> => ({
    ...((a as Record<string, unknown>) || {}),
    ...((b as Record<string, unknown>) || {}),
  });

  const mergeArray = (a: unknown, b: unknown): unknown[] => [
    ...((a as unknown[]) || []),
    ...((b as unknown[]) || []),
  ];

  return {
    ...honoSpec,
    openapi:
      (honoSpec as { openapi?: string }).openapi ||
      (authSpec as { openapi?: string }).openapi ||
      "3.0.3",
    info:
      (honoSpec as { info?: unknown }).info ||
      (authSpec as { info?: unknown }).info,
    servers:
      (honoSpec as { servers?: unknown[] }).servers ||
      (authSpec as { servers?: unknown[] }).servers,
    security:
      (honoSpec as { security?: unknown[] }).security ||
      (authSpec as { security?: unknown[] }).security,
    paths: mergeRecord(
      (honoSpec as { paths?: unknown }).paths,
      (authSpec as { paths?: unknown }).paths,
    ),
    tags: mergeArray(
      (honoSpec as { tags?: unknown[] }).tags,
      (authSpec as { tags?: unknown[] }).tags,
    ),
    components: {
      ...mergeRecord(
        (honoSpec as { components?: unknown }).components,
        (authSpec as { components?: unknown }).components,
      ),
      schemas: mergeRecord(
        (honoSpec as { components?: { schemas?: unknown } }).components
          ?.schemas,
        (authSpec as { components?: { schemas?: unknown } }).components
          ?.schemas,
      ),
      securitySchemes: mergeRecord(
        (honoSpec as { components?: { securitySchemes?: unknown } }).components
          ?.securitySchemes,
        (authSpec as { components?: { securitySchemes?: unknown } }).components
          ?.securitySchemes,
      ),
    },
  };
};

export const dedupeOperationIds = (spec: Record<string, unknown>) => {
  const paths = ((spec as { paths?: unknown }).paths || {}) as Record<
    string,
    unknown
  >;
  const seen = new Set<string>();

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as
        | Record<string, unknown>
        | undefined;

      if (!operation || typeof operation !== "object") {
        continue;
      }

      const operationId = operation.operationId;
      if (typeof operationId !== "string" || operationId.length === 0) {
        continue;
      }

      if (!seen.has(operationId)) {
        seen.add(operationId);
        continue;
      }

      const pathSuffix = path
        .replace(/\//g, "_")
        .replace(/[{}]/g, "")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
      const nextId = `${operationId}_${method}_${pathSuffix || "root"}`;
      operation.operationId = nextId;
      seen.add(nextId);
    }
  }

  return spec;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const setObjectContents = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
) => {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, source);
};

export const normalizeNullableSchemasForOpenApi30 = (
  spec: Record<string, unknown>,
) => {
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }

    if (!isPlainObject(node)) {
      return;
    }

    const typeValue = node.type;
    if (Array.isArray(typeValue)) {
      const nullRemoved = typeValue.filter((entry) => entry !== "null");
      const hadNull = nullRemoved.length !== typeValue.length;

      if (hadNull && nullRemoved.length === 1) {
        node.type = nullRemoved[0];
        node.nullable = true;
      }
    }

    const anyOfValue = node.anyOf;
    if (Array.isArray(anyOfValue) && anyOfValue.length >= 2) {
      const nullSchema = anyOfValue.find(
        (entry) => isPlainObject(entry) && entry.type === "null",
      );
      const nonNullSchemas = anyOfValue.filter(
        (entry) => !(isPlainObject(entry) && entry.type === "null"),
      );

      if (
        nullSchema &&
        nonNullSchemas.length === 1 &&
        isPlainObject(nonNullSchemas[0])
      ) {
        const { anyOf: _anyOf, ...rest } = node;
        setObjectContents(node, {
          ...rest,
          ...(nonNullSchemas[0] as Record<string, unknown>),
          nullable: true,
        });
      }
    }

    for (const value of Object.values(node)) {
      visit(value);
    }
  };

  visit(spec);
  return spec;
};

export const normalizeEmptyRequiredArrays = (spec: Record<string, unknown>) => {
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }

    if (!isPlainObject(node)) {
      return;
    }

    if (Array.isArray(node.required) && node.required.length === 0) {
      delete node.required;
    }

    for (const value of Object.values(node)) {
      visit(value);
    }
  };

  visit(spec);
  return spec;
};

export const markOptionalSchemaFieldsNullable = (
  spec: Record<string, unknown>,
) => {
  const schemas = ((spec as { components?: { schemas?: unknown } }).components
    ?.schemas || {}) as Record<string, unknown>;

  for (const schema of Object.values(schemas)) {
    if (!isPlainObject(schema)) continue;

    const properties = schema.properties as Record<string, unknown> | undefined;
    if (!isPlainObject(properties)) continue;

    const required = Array.isArray(schema.required) ? schema.required : [];

    for (const [name, prop] of Object.entries(properties)) {
      if (required.includes(name)) continue;
      if (!isPlainObject(prop)) continue;
      if (prop.nullable === true) continue;
      if (typeof prop.type !== "string") continue;

      prop.nullable = true;
    }
  }

  return spec;
};

export const normalizeEmptyAndEnumSchemas = (spec: Record<string, unknown>) => {
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }

    if (!isPlainObject(node)) {
      return;
    }

    // propertyNames is not valid in OpenAPI 3.0.x — remove it
    if ("propertyNames" in node) {
      delete node.propertyNames;
    }

    // Schema with enum but no type → add type: "string"
    if (Array.isArray(node.enum) && !node.type && !node.$ref) {
      node.type = "string";
    }

    // $ref with siblings is invalid in 3.0.x → wrap in allOf
    if (typeof node.$ref === "string" && Object.keys(node).length > 1) {
      const ref = node.$ref as string;
      delete node.$ref;
      const rest = { ...node };
      for (const k of Object.keys(node)) {
        delete node[k];
      }
      Object.assign(node, { allOf: [{ $ref: ref }], ...rest });
    }

    // For "properties" maps, check children for empty schemas (v.date() → {})
    if (isPlainObject(node.properties)) {
      const props = node.properties as Record<string, unknown>;
      for (const [name, schema] of Object.entries(props)) {
        if (isPlainObject(schema) && Object.keys(schema).length === 0) {
          props[name] = { type: "string", format: "date-time" };
        }
      }
    }

    for (const [k, value] of Object.entries(node)) {
      // Replace remaining empty schemas {} (e.g. v.any() or v.unknown()).
      if (isPlainObject(value) && Object.keys(value).length === 0) {
        // additionalProperties: {} → true (means "any additional properties")
        node[k] = k === "additionalProperties" ? true : { type: "object" };
        continue;
      }
      visit(value);
    }
  };

  visit(spec);
  return spec;
};

export const ensureOperationSummaries = (spec: Record<string, unknown>) => {
  const paths = ((spec as { paths?: unknown }).paths || {}) as Record<
    string,
    unknown
  >;

  for (const pathItem of Object.values(paths)) {
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as
        | Record<string, unknown>
        | undefined;
      if (!operation || typeof operation !== "object") {
        continue;
      }

      const summary = operation.summary;
      if (typeof summary === "string" && summary.trim().length > 0) {
        continue;
      }

      const operationId = operation.operationId;
      if (typeof operationId !== "string" || operationId.trim().length === 0) {
        continue;
      }

      const words = splitCamelCase(operationId);
      if (words.length === 0) {
        continue;
      }

      operation.summary = words.map((word) => wordCapitalize(word)).join(" ");
    }
  }

  return spec;
};
