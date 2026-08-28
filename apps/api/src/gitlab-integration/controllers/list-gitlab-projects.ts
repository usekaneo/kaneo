import { HTTPException } from "hono/http-exception";
import { normalizeGitlabBaseUrl } from "../../plugins/gitlab/config";
import {
  type GitlabTokenType,
  listGitlabMemberProjects,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

type ProjectRow = {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  namespace: string;
  private: boolean;
  web_url: string;
};

const PER_PAGE = 50;
const MAX_PAGES = 50;

async function listGitlabProjects({
  baseUrl,
  accessToken,
  tokenType = "pat",
}: {
  baseUrl: string;
  accessToken: string;
  tokenType?: GitlabTokenType;
}): Promise<{ projects: ProjectRow[] }> {
  const normalized = normalizeGitlabBaseUrl(baseUrl);

  try {
    await verifyGitlabToken(normalized, accessToken, tokenType);
  } catch {
    throw new HTTPException(401, {
      message: "Invalid GitLab token or could not reach instance.",
    });
  }

  const all: ProjectRow[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const batch = await listGitlabMemberProjects(
      normalized,
      accessToken,
      tokenType,
      page,
      PER_PAGE,
    );
    if (!batch.length) break;

    for (const project of batch) {
      const namespace =
        project.namespace?.full_path ??
        project.path_with_namespace.split("/").slice(0, -1).join("/");

      all.push({
        id: project.id,
        name: project.name,
        path: project.path,
        path_with_namespace: project.path_with_namespace,
        namespace,
        private: project.visibility !== "public",
        web_url: project.web_url,
      });
    }

    if (batch.length < PER_PAGE) break;
    page += 1;
  }

  return { projects: all };
}

export default listGitlabProjects;
