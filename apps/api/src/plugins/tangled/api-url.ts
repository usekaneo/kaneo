import { isIP } from "node:net";
import { tangledRefSchema, tangledRepositoryDidSchema } from "./api-contract";

type TangledApiQuery = { repositoryDid: string } & (
  | { method: "getRef"; ref: string }
  | { method: "listBranches"; limit?: number; cursor?: string }
  | { method: "getRepoByRepoDid" }
);

// URL validation does not replace DNS checks at the outbound connection boundary.
export function parseTangledApiOrigin(origin: string): URL {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    url.origin !== origin ||
    url.port !== "" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    isIP(url.hostname.replace(/^\[|\]$/g, ""))
  ) {
    throw new Error(
      "Tangled read API requires an HTTPS hostname origin on port 443",
    );
  }
  return url;
}

export function buildTangledApiUrl(
  origin: string,
  query: TangledApiQuery,
): URL {
  const url = parseTangledApiOrigin(origin);
  if (!tangledRepositoryDidSchema.safeParse(query.repositoryDid).success) {
    throw new Error(
      "Tangled read API requires a repository DID, not an owner/record key",
    );
  }

  const namespace = query.method === "getRepoByRepoDid" ? "repo" : "temp.git";
  url.pathname = `/xrpc/org.tangled.${namespace}.${query.method}`;
  url.searchParams.set(
    query.method === "getRepoByRepoDid" ? "repoDid" : "repo",
    query.repositoryDid,
  );

  if (query.method === "getRef") {
    if (!tangledRefSchema.shape.name.safeParse(query.ref).success) {
      throw new Error("Tangled branch lookup requires a refs/heads/ reference");
    }
    url.searchParams.set("ref", query.ref);
  }
  if (query.method === "listBranches") {
    if (query.limit !== undefined) {
      if (
        !Number.isInteger(query.limit) ||
        query.limit < 1 ||
        query.limit > 100
      ) {
        throw new Error("Tangled branch page size must be between 1 and 100");
      }
      url.searchParams.set("limit", String(query.limit));
    }
    if (query.cursor !== undefined) {
      if (!query.cursor)
        throw new Error("Tangled branch cursor cannot be empty");
      url.searchParams.set("cursor", query.cursor);
    }
  }
  return url;
}
