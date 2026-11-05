import { describe, expect, it } from "vite-plus/test";
import {
  tangledBranchesSchema,
  tangledRefSchema,
  tangledRepositorySchema,
} from "./api-contract";

const repoDid = "did:plc:sjazesp3pinxlmgju2va46jd";
const oid = "86aaadbef20a98ac8055ab25ea538a466748e428";

// Reduced public Bagend responses; commit authors and messages are not retained.
describe("Tangled read API responses", () => {
  it("reads current getRef responses without retaining commit metadata", () => {
    expect(
      tangledRefSchema.parse({
        name: "refs/heads/main",
        oid,
        message: "a commit message",
        author: { name: "author", email: "private@example.test" },
        totalCommits: 6,
      }),
    ).toEqual({ name: "refs/heads/main", oid });
  });

  it.each([
    { name: "refs/heads/main", hash: oid },
    { name: "refs/heads/main", oid: "not-a-git-object-id" },
    { name: "refs/heads/", oid },
    { name: "refs/tags/v1", oid },
    { name: "main", oid },
    { name: "refs/heads/main\n", oid },
  ])("rejects malformed or non-branch current-head responses: %j", (value) => {
    expect(tangledRefSchema.safeParse(value).success).toBe(false);
  });

  it("accepts SHA-256 object identifiers", () => {
    expect(
      tangledRefSchema.safeParse({
        name: "refs/heads/main",
        oid: "a".repeat(64),
      }).success,
    ).toBe(true);
  });

  it("reads branch pages and preserves their pagination cursor", () => {
    expect(
      tangledBranchesSchema.parse({
        branches: [
          {
            name: "feat/identity-recovery",
            oid,
            author: { email: "private@example.test" },
          },
          { name: "main", oid },
        ],
        total: 3,
        defaultBranch: "main",
        cursor: "page/+2=",
      }),
    ).toEqual({
      branches: [
        { name: "feat/identity-recovery", oid },
        { name: "main", oid },
      ],
      total: 3,
      cursor: "page/+2=",
    });
  });

  it("accepts a complete empty branch list", () => {
    expect(tangledBranchesSchema.parse({ branches: [], total: 0 })).toEqual({
      branches: [],
      total: 0,
    });
  });

  it.each([
    { branches: [{ name: "main", oid }] },
    { branches: [{ name: "main", oid }], total: 0 },
    { branches: [], total: -1 },
    { branches: [], total: 1.5 },
    { branches: [], total: 0, cursor: "" },
    { branches: [], total: 0, cursor: 2 },
    { branches: [{ name: "", oid }], total: 1 },
    { branches: [{ name: "main", oid: "bad" }], total: 1 },
    {
      branches: [
        { name: "main", oid },
        { name: "main", oid },
      ],
      total: 2,
    },
  ])("rejects unsafe branch pages: %j", (value) => {
    expect(tangledBranchesSchema.safeParse(value).success).toBe(false);
  });

  it("keeps repository DID separate from manifest owner and name", () => {
    expect(
      tangledRepositorySchema.parse({
        uri: `at://${repoDid}/org.tangled.repo.manifest/self`,
        value: {
          $type: "org.tangled.repo.manifest",
          declaration: {
            owner: "did:plc:3y7qwlbdixlos4qfg5smwgsb",
            name: "bagend",
          },
          description: "not needed by Kaneo",
        },
        knot: "knot1.tangled.sh",
        cid: "not retained",
      }),
    ).toEqual({
      uri: `at://${repoDid}/org.tangled.repo.manifest/self`,
      value: {
        $type: "org.tangled.repo.manifest",
        declaration: {
          owner: "did:plc:3y7qwlbdixlos4qfg5smwgsb",
          name: "bagend",
        },
      },
    });
  });

  it.each(["", ".", "..", "../other", "name/extra", "name with spaces"])(
    "rejects malformed manifest names: %s",
    (name) => {
      expect(
        tangledRepositorySchema.safeParse({
          uri: `at://${repoDid}/org.tangled.repo.manifest/self`,
          value: {
            $type: "org.tangled.repo.manifest",
            declaration: { owner: repoDid, name },
          },
        }).success,
      ).toBe(false);
    },
  );

  it.each([
    {
      uri: `at://${repoDid}/sh.tangled.repo/bagend`,
      value: { $type: "sh.tangled.repo" },
    },
    { uri: `at://${repoDid}/org.tangled.repo.manifest/self`, value: {} },
    {
      uri: "not-an-at-uri",
      value: {
        $type: "org.tangled.repo.manifest",
        declaration: { owner: repoDid, name: "bagend" },
      },
    },
    {
      uri: `at://${repoDid}/org.tangled.repo.manifest/self`,
      value: {
        $type: "org.tangled.repo.manifest",
        declaration: { owner: "owner", name: "bagend" },
      },
    },
  ])("rejects unbound or legacy repository metadata: %j", (value) => {
    expect(tangledRepositorySchema.safeParse(value).success).toBe(false);
  });
});
