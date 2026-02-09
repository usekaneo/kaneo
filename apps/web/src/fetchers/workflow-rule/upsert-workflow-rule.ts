import { client } from "@kaneo/libs";

async function upsertWorkflowRule(
  projectId: string,
  data: { integrationType: string; eventType: string; columnId: string },
) {
  const response = await client["workflow-rule"][":projectId"].$put({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default upsertWorkflowRule;
