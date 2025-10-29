import { and, ilike } from "drizzle-orm";
import db from "../../database";
import { githubIntegrationTable } from "../../database/schema";

async function getGithubIntegrationByRepositoryId(
  repositoryOwner: string,
  repositoryName: string,
) {
  const integration = await db.query.githubIntegrationTable.findFirst({
    where: and(
      ilike(githubIntegrationTable.repositoryOwner, repositoryOwner),
      ilike(githubIntegrationTable.repositoryName, repositoryName),
    ),
  });

  return integration;
}

export default getGithubIntegrationByRepositoryId;
