import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function upsertWorkflowRule(
  projectId: string,
  data: { integrationType: string; eventType: string; columnId: string },
) {
  const response = await client["workflow-rule"][":projectId"].$put({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default upsertWorkflowRule;
