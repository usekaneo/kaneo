import type { GitHubConfig } from "../../github/config";
import {
  extractTaskNumber,
  extractTaskNumberFromBranch,
  extractTaskNumberFromPRBody,
  extractTaskNumberFromPRTitle,
  generateBranchName,
} from "../../github/utils/branch-matcher";
import type { GitlabConfig } from "../config";

function asBranchConfig(config: GitlabConfig): GitHubConfig {
  return config as unknown as GitHubConfig;
}

export {
  extractTaskNumberFromPRBody,
  extractTaskNumberFromPRTitle,
  generateBranchName,
};

export function extractTaskNumberFromBranchGitlab(
  branchName: string,
  config: GitlabConfig,
  projectSlug: string,
): number | null {
  return extractTaskNumberFromBranch(
    branchName,
    asBranchConfig(config),
    projectSlug,
  );
}

export function extractTaskNumberGitlab(
  branchName: string,
  mrTitle: string | undefined,
  mrBody: string | undefined,
  config: GitlabConfig,
  projectSlug: string,
): number | null {
  return extractTaskNumber(
    branchName,
    mrTitle,
    mrBody,
    asBranchConfig(config),
    projectSlug,
  );
}
