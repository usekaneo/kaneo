function field(value: unknown, key: string) {
  const found = (value as Record<string, unknown> | null | undefined)?.[key];
  return typeof found === "string" ? found : undefined;
}

export function logImportError(context: string, runId: string, error: unknown) {
  const cause = (error as { cause?: unknown } | null)?.cause ?? error;
  console.error(context, {
    runId,
    error: error instanceof Error ? error.name : typeof error,
    code: field(cause, "code"),
    constraint: field(cause, "constraint"),
  });
}
