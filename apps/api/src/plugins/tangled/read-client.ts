import {
  tangledBranchesSchema,
  tangledRefSchema,
  tangledRepositorySchema,
  type TangledBranchPage,
  type TangledRef,
} from "./api-contract";
import { buildTangledApiUrl } from "./api-url";
import { requestTangledJson } from "./request-json";

type RepositoryBinding = {
  repositoryDid: string;
  webhookRepositoryFullName: string;
};

type TangledReadClient = {
  getRepository(): Promise<RepositoryBinding>;
  getBranch(ref: string): Promise<TangledRef>;
  listBranches(): Promise<TangledBranchPage["branches"]>;
};

export function createTangledReadClient(
  config: { origin: string; repositoryDid: string },
  requestJson: (url: URL) => Promise<unknown> = requestTangledJson,
): TangledReadClient {
  return {
    async getRepository() {
      const url = buildTangledApiUrl(config.origin, {
        method: "getRepoByRepoDid",
        repositoryDid: config.repositoryDid,
      });
      const result = tangledRepositorySchema.safeParse(await requestJson(url));
      if (
        !result.success ||
        result.data.uri !==
          `at://${config.repositoryDid}/org.tangled.repo.manifest/self`
      ) {
        throw new Error(
          "Tangled read API did not return the configured repository manifest",
        );
      }
      const { owner, name } = result.data.value.declaration;
      return {
        repositoryDid: config.repositoryDid,
        webhookRepositoryFullName: `${owner}/${name.toLowerCase()}`,
      };
    },
    async getBranch(ref) {
      const url = buildTangledApiUrl(config.origin, {
        method: "getRef",
        repositoryDid: config.repositoryDid,
        ref,
      });
      const result = tangledRefSchema.safeParse(await requestJson(url));
      if (!result.success || result.data.name !== ref) {
        throw new Error("Tangled read API did not return the requested branch");
      }
      return result.data;
    },
    async listBranches() {
      const branches: TangledBranchPage["branches"] = [];
      const names = new Set<string>();
      const cursors = new Set<string>();
      let cursor: string | undefined;
      let total: number | undefined;
      for (let page = 0; page < 10; page++) {
        const url = buildTangledApiUrl(config.origin, {
          method: "listBranches",
          repositoryDid: config.repositoryDid,
          limit: 100,
          cursor,
        });
        const parsed = tangledBranchesSchema.safeParse(await requestJson(url));
        if (!parsed.success)
          throw new Error("Tangled read API returned an invalid branch page");
        const result = parsed.data;
        if (result.total > 1000)
          throw new Error(
            "Tangled repository exceeds the branch reconciliation limit",
          );
        if (total !== undefined && total !== result.total)
          throw new Error("Tangled branch total changed during pagination");
        total = result.total;
        for (const branch of result.branches) {
          if (names.has(branch.name))
            throw new Error("Tangled read API returned a duplicate branch");
          names.add(branch.name);
          branches.push(branch);
        }
        if (branches.length > total)
          throw new Error("Tangled branch list exceeds the reported total");
        if (result.cursor === undefined) {
          if (branches.length !== total)
            throw new Error("Tangled branch list is incomplete");
          return branches;
        }
        if (!result.branches.length || cursors.has(result.cursor)) {
          throw new Error("Tangled branch cursor did not advance");
        }
        cursors.add(result.cursor);
        cursor = result.cursor;
      }
      throw new Error("Tangled branch pagination exceeded its request limit");
    },
  };
}
