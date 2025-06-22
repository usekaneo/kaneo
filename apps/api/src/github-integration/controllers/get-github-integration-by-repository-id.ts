import { and, eq } from "drizzle-orm";
import db from "../../database";
import { githubIntegrationTable } from "../../database/schema";

async function getGithubIntegrationByRepositoryId(
  repositoryOwner: string,
  repositoryName: string,
) {
  const integration = await db.query.githubIntegrationTable.findFirst({
    where: and(
      eq(githubIntegrationTable.repositoryOwner, repositoryOwner),
      eq(githubIntegrationTable.repositoryName, repositoryName),
    ),
  });

  return integration;
}

export default getGithubIntegrationByRepositoryId;
