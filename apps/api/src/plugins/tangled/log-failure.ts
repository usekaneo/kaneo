type FailureStage =
  | "webhook"
  | "reconciliation"
  | "repository_lookup"
  | "branch_lookup";

type FailureCategory =
  | "database_constraint"
  | "database_schema"
  | "database_timeout"
  | "database_connection"
  | "timeout"
  | "unexpected";

function category(error: unknown): FailureCategory {
  let current = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth++) {
    const code = "code" in current ? current.code : undefined;
    switch (code) {
      case "23502":
      case "23503":
      case "23505":
      case "23514":
        return "database_constraint";
      case "42P01":
      case "42703":
      case "42704":
        return "database_schema";
      case "57014":
      case "55P03":
        return "database_timeout";
      case "08000":
      case "08003":
      case "08006":
      case "53300":
      case "57P01":
        return "database_connection";
    }
    if (
      current.name === "AbortError" ||
      current.name === "TimeoutError" ||
      current.message === "Tangled API request timed out"
    )
      return "timeout";
    current = current.cause;
  }
  return "unexpected";
}

export function logTangledFailure(stage: FailureStage, error: unknown): void {
  console.error("Tangled processing failed", {
    stage,
    category: category(error),
  });
}
