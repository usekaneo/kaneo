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
    Object.entries(paths).filter(([path]) => path.startsWith("/organization")),
  ) as Record<string, unknown>;

  for (const [path, pathItem] of Object.entries(organizationPaths)) {
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }

    const endpointWords = toWords(path.replace(/^\/organization\/?/, ""));
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
