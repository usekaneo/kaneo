import {
  extractTaskNumber,
  extractTaskNumberFromBranch,
  extractTaskNumberFromPRBody,
  extractTaskNumberFromPRTitle,
  generateBranchName,
} from "../../github/utils/branch-matcher";
import type { GitlabConfig } from "../config";

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
  return extractTaskNumberFromBranch(branchName, config, projectSlug);
}

export function extractTaskNumberGitlab(
  branchName: string,
  mrTitle: string | undefined,
  mrDescription: string | undefined,
  config: GitlabConfig,
  projectSlug: string,
): number | null {
  return extractTaskNumber(
    branchName,
    mrTitle,
    mrDescription,
    config,
    projectSlug,
  );
}
