import { HTTPException } from "hono/http-exception";
import { normalizeGitlabBaseUrl } from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";

type ProjectRow = {
  id: number;
  name: string;
  path_with_namespace: string;
  visibility: string;
  web_url: string;
};

async function listGitlabRepositories({
  baseUrl,
  accessToken,
}: {
  baseUrl: string;
  accessToken: string;
}): Promise<{ repositories: ProjectRow[] }> {
  const normalized = normalizeGitlabBaseUrl(baseUrl);

  try {
    await verifyGitlabToken(normalized, accessToken);
  } catch {
    throw new HTTPException(401, {
      message: "Invalid GitLab token or could not reach instance.",
    });
  }

  const client = createGitlabClient({
    baseUrl: normalized,
    accessToken,
  });

  const all: ProjectRow[] = [];
  let page = 1;

  while (true) {
    const batch = await client.listUserProjects(page, 50);
    if (!batch.length) break;

    all.push(...batch);

    if (batch.length < 50) break;
    page += 1;
    if (page > 50) break;
  }

  return { repositories: all };
}

export default listGitlabRepositories;
