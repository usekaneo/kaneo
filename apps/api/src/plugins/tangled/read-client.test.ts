import { describe, expect, it } from "vite-plus/test";
import { createTangledReadClient } from "./read-client";

const repositoryDid = "did:plc:sjazesp3pinxlmgju2va46jd";
const oid = "86aaadbef20a98ac8055ab25ea538a466748e428";
const config = { origin: "https://api.tangled.org", repositoryDid };

function manifest(did = repositoryDid): unknown {
  return {
    uri: `at://${did}/org.tangled.repo.manifest/self`,
    value: {
      $type: "org.tangled.repo.manifest",
      declaration: {
        owner: "did:plc:3y7qwlbdixlos4qfg5smwgsb",
        name: "Bagend",
      },
    },
    knot: "untrusted-do-not-fetch.example",
  };
}

describe("Tangled read client", () => {
  it("binds a manifest to the configured repository DID and derives the webhook identity", async () => {
    const urls: string[] = [];
    const client = createTangledReadClient(config, async (url) => {
      urls.push(url.toString());
      return manifest();
    });
    await expect(client.getRepository()).resolves.toEqual({
      repositoryDid,
      webhookRepositoryFullName: "did:plc:3y7qwlbdixlos4qfg5smwgsb/bagend",
    });
    expect(urls).toEqual([
      "https://api.tangled.org/xrpc/org.tangled.repo.getRepoByRepoDid?repoDid=did%3Aplc%3Asjazesp3pinxlmgju2va46jd",
    ]);
  });

  it("rejects a different repository manifest", async () => {
    const client = createTangledReadClient(config, async () =>
      manifest("did:plc:another"),
    );
    await expect(client.getRepository()).rejects.toThrow(/repository/);
  });

  it("checks the exact returned branch ref instead of accepting another branch", async () => {
    const client = createTangledReadClient(config, async (url) => {
      expect(url.pathname).toBe("/xrpc/org.tangled.temp.git.getRef");
      expect(url.searchParams.get("repo")).toBe(repositoryDid);
      expect(url.searchParams.get("ref")).toBe("refs/heads/feat/a&b");
      return { name: "refs/heads/main", oid };
    });
    await expect(client.getBranch("refs/heads/feat/a&b")).rejects.toThrow(
      /branch/,
    );
  });

  it("reads a verified current head", async () => {
    const client = createTangledReadClient(config, async () => ({
      name: "refs/heads/main",
      oid,
    }));
    await expect(client.getBranch("refs/heads/main")).resolves.toEqual({
      name: "refs/heads/main",
      oid,
    });
  });

  it("returns all pages only when the reported total is satisfied", async () => {
    const cursors: (string | null)[] = [];
    const client = createTangledReadClient(config, async (url) => {
      expect(url.pathname).toBe("/xrpc/org.tangled.temp.git.listBranches");
      expect(url.searchParams.get("repo")).toBe(repositoryDid);
      expect(url.searchParams.get("limit")).toBe("100");
      const cursor = url.searchParams.get("cursor");
      cursors.push(cursor);
      return cursor === null
        ? { branches: [{ name: "main", oid }], total: 2, cursor: "page/+2=" }
        : { branches: [{ name: "feat/identity-recovery", oid }], total: 2 };
    });
    await expect(client.listBranches()).resolves.toEqual([
      { name: "main", oid },
      { name: "feat/identity-recovery", oid },
    ]);
    expect(cursors).toEqual([null, "page/+2="]);
  });

  it("accepts an authoritative empty list", async () => {
    const client = createTangledReadClient(config, async () => ({
      branches: [],
      total: 0,
    }));
    await expect(client.listBranches()).resolves.toEqual([]);
  });

  it.each([
    { branches: [{ name: "main", oid }], total: 2 },
    { branches: [], total: 1, cursor: "next" },
    { branches: [], total: 1001 },
  ])("rejects incomplete or oversized listings: %j", async (page) => {
    const client = createTangledReadClient(config, async () => page);
    await expect(client.listBranches()).rejects.toThrow();
  });

  it("rejects duplicate branches across pages", async () => {
    let page = 0;
    const client = createTangledReadClient(config, async () => ({
      branches: [{ name: "main", oid }],
      total: 2,
      ...(page++ === 0 ? { cursor: "next" } : {}),
    }));
    await expect(client.listBranches()).rejects.toThrow(/duplicate/i);
  });

  it("rejects a repeated cursor instead of looping", async () => {
    let page = 0;
    const client = createTangledReadClient(config, async () => ({
      branches: [{ name: `branch-${page++}`, oid }],
      total: 3,
      cursor: "repeated",
    }));
    await expect(client.listBranches()).rejects.toThrow(/cursor/i);
    expect(page).toBe(2);
  });

  it("rejects a changed total while paginating", async () => {
    let page = 0;
    const client = createTangledReadClient(config, async () =>
      page++ === 0
        ? { branches: [{ name: "main", oid }], total: 2, cursor: "next" }
        : { branches: [{ name: "other", oid }], total: 3 },
    );
    await expect(client.listBranches()).rejects.toThrow(/changed/i);
  });

  it("never returns a partial result after an upstream failure", async () => {
    let page = 0;
    const client = createTangledReadClient(config, async () => {
      if (page++ === 0)
        return { branches: [{ name: "main", oid }], total: 2, cursor: "next" };
      throw new Error("network unavailable");
    });
    await expect(client.listBranches()).rejects.toThrow(/network unavailable/);
  });

  it("bounds the number of pagination requests", async () => {
    let page = 0;
    const client = createTangledReadClient(config, async () => ({
      branches: [{ name: `branch-${page++}`, oid }],
      total: 100,
      cursor: String(page),
    }));
    await expect(client.listBranches()).rejects.toThrow(/limit/i);
    expect(page).toBeLessThanOrEqual(10);
  });
});
