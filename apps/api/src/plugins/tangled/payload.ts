type RepositoryPayload = {
  full_name: string;
};

type PushPayload = {
  type: "push";
  ref: string;
  refType: "branch" | "tag";
  repositoryFullName: string;
};

type PullRequestPayload = {
  type: "pull_request";
  action: "created" | "resubmitted" | "merged" | "closed" | "reopened";
  repositoryFullName: string;
};

export type TangledPayload = PushPayload | PullRequestPayload;

const pullRequestActions = [
  "created",
  "resubmitted",
  "merged",
  "closed",
  "reopened",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRepository(
  payload: Record<string, unknown>,
): RepositoryPayload | null {
  if (!isRecord(payload.repository)) return null;
  const fullName = payload.repository.full_name;
  if (typeof fullName !== "string" || fullName.trim().length === 0) return null;
  return { full_name: fullName };
}

export function validateTangledPayload(
  eventHeader: string | undefined,
  value: unknown,
): TangledPayload | null {
  if (!isRecord(value)) return null;
  const repository = getRepository(value);
  if (!repository) return null;

  if (eventHeader === "push") {
    if (typeof value.ref !== "string") return null;
    const refType = value.ref.startsWith("refs/heads/")
      ? "branch"
      : value.ref.startsWith("refs/tags/")
        ? "tag"
        : null;
    if (
      !refType ||
      value.ref.length ===
        `refs/${refType === "branch" ? "heads" : "tags"}/`.length
    ) {
      return null;
    }
    return {
      type: "push",
      ref: value.ref,
      refType,
      repositoryFullName: repository.full_name,
    };
  }

  if (!eventHeader?.startsWith("pull_request:")) return null;
  const headerAction = eventHeader.slice("pull_request:".length);
  if (
    !pullRequestActions.includes(
      headerAction as (typeof pullRequestActions)[number],
    )
  ) {
    return null;
  }
  if (value.action !== headerAction || !isRecord(value.pull_request)) {
    return null;
  }
  return {
    type: "pull_request",
    action: headerAction as PullRequestPayload["action"],
    repositoryFullName: repository.full_name,
  };
}
