import { and, eq } from "drizzle-orm";
import db from "../../database";
import { giteaIntegrationTable } from "../../database/schema";

async function getGiteaIntegrationByRepository(
  repositoryOwner: string,
  repositoryName: string,
) {
  const integration = await db.query.giteaIntegrationTable.findFirst({
    where: and(
      eq(giteaIntegrationTable.repositoryOwner, repositoryOwner),
      eq(giteaIntegrationTable.repositoryName, repositoryName),
      eq(giteaIntegrationTable.isActive, true),
    ),
  });

  return integration;
}

export default getGiteaIntegrationByRepository;
