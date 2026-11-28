import { describe, expect, it } from "vite-plus/test";
import { validateTangledPayload } from "./payload";

const repository = { full_name: "did:plc:owner/record" };

describe("validateTangledPayload", () => {
  it("accepts push payloads for branch and tag refs", () => {
    for (const [ref, refType] of [
      ["refs/heads/main", "branch"],
      ["refs/tags/v1.0.0", "tag"],
    ] as const) {
      expect(
        validateTangledPayload("push", {
          ref,
          before: "old",
          after: "new",
          pusher: { did: "did:plc:owner" },
          repository,
        }),
      ).toEqual({
        type: "push",
        ref,
        refType,
        repositoryFullName: repository.full_name,
      });
    }
  });

  it("accepts supported pull request event and body actions", () => {
    const actions = ["created", "resubmitted", "merged", "closed", "reopened"];
    for (const action of actions) {
      expect(
        validateTangledPayload(`pull_request:${action}`, {
          action,
          pull_request: { target_branch: "main" },
          repository,
        }),
      ).toEqual({
        type: "pull_request",
        action,
        repositoryFullName: repository.full_name,
      });
    }
  });

  it("does not treat the untrusted event header as the body action", () => {
    expect(
      validateTangledPayload("pull_request:created", {
        action: "closed",
        pull_request: {},
        repository,
      }),
    ).toBeNull();
  });

  it("rejects empty branch and tag names", () => {
    for (const ref of ["refs/heads/", "refs/tags/"]) {
      expect(validateTangledPayload("push", { ref, repository })).toBeNull();
    }
  });

  it("rejects whitespace-only repository identifiers", () => {
    expect(
      validateTangledPayload("push", {
        ref: "refs/heads/main",
        repository: { full_name: "   " },
      }),
    ).toBeNull();
  });

  it("rejects unsupported events, malformed payloads, and invalid refs", () => {
    expect(
      validateTangledPayload("repository:renamed", { repository }),
    ).toBeNull();
    expect(
      validateTangledPayload("push", { ref: "main", repository }),
    ).toBeNull();
    expect(
      validateTangledPayload("push", { ref: "refs/heads/main" }),
    ).toBeNull();
    expect(
      validateTangledPayload("pull_request:created", {
        action: "created",
        pull_request: {},
        repository: { full_name: "" },
      }),
    ).toBeNull();
    expect(validateTangledPayload("push", null)).toBeNull();
  });
});
