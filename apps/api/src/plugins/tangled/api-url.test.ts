import { describe, expect, it } from "vite-plus/test";
import { buildTangledApiUrl } from "./api-url";

const repositoryDid = "did:plc:sjazesp3pinxlmgju2va46jd";

describe("buildTangledApiUrl", () => {
  it("uses getRef with the stable repository DID and the exact full branch ref", () => {
    const url = buildTangledApiUrl("https://api.tangled.org", {
      method: "getRef",
      repositoryDid,
      ref: "refs/heads/feature/a&b+#1",
    });
    expect(url.origin).toBe("https://api.tangled.org");
    expect(url.pathname).toBe("/xrpc/org.tangled.temp.git.getRef");
    expect([...url.searchParams]).toEqual([
      ["repo", repositoryDid],
      ["ref", "refs/heads/feature/a&b+#1"],
    ]);
    expect(url.hash).toBe("");
  });

  it("encodes opaque pagination cursors without changing them", () => {
    const url = buildTangledApiUrl("https://api.tangled.example", {
      method: "listBranches",
      repositoryDid,
      limit: 100,
      cursor: "page/+2=&other=value",
    });
    expect(url.pathname).toBe("/xrpc/org.tangled.temp.git.listBranches");
    expect([...url.searchParams]).toEqual([
      ["repo", repositoryDid],
      ["limit", "100"],
      ["cursor", "page/+2=&other=value"],
    ]);
  });

  it("uses repoDid rather than repo for the repository manifest lookup", () => {
    const url = buildTangledApiUrl("https://api.tangled.org", {
      method: "getRepoByRepoDid",
      repositoryDid,
    });
    expect(url.pathname).toBe("/xrpc/org.tangled.repo.getRepoByRepoDid");
    expect([...url.searchParams]).toEqual([["repoDid", repositoryDid]]);
  });

  it.each([
    "http://api.tangled.org",
    "https://user:secret@api.tangled.org",
    "https://api.tangled.org/path",
    "https://api.tangled.org?query=1",
    "https://api.tangled.org#fragment",
    "https://api.tangled.org:8443",
    "https://127.0.0.1",
    "https://[::1]",
  ])("rejects unsafe or ambiguous API origins: %s", (origin) => {
    expect(() =>
      buildTangledApiUrl(origin, { method: "listBranches", repositoryDid }),
    ).toThrow();
  });

  it("rejects legacy webhook identity as the repository DID", () => {
    expect(() =>
      buildTangledApiUrl("https://api.tangled.org", {
        method: "listBranches",
        repositoryDid: "did:plc:owner/bagend",
      }),
    ).toThrow();
  });

  it.each(["main", "refs/tags/v1", "refs/heads/"])(
    "rejects non-branch refs: %s",
    (ref) => {
      expect(() =>
        buildTangledApiUrl("https://api.tangled.org", {
          method: "getRef",
          repositoryDid,
          ref,
        }),
      ).toThrow();
    },
  );

  it.each([0, 101, 1.5, Number.NaN])(
    "rejects invalid page size %s",
    (limit) => {
      expect(() =>
        buildTangledApiUrl("https://api.tangled.org", {
          method: "listBranches",
          repositoryDid,
          limit,
        }),
      ).toThrow();
    },
  );

  it("rejects empty pagination cursors", () => {
    expect(() =>
      buildTangledApiUrl("https://api.tangled.org", {
        method: "listBranches",
        repositoryDid,
        cursor: "",
      }),
    ).toThrow();
  });
});
