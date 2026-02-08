import { client } from "@kaneo/libs";

async function getWorkflowRules(projectId: string) {
  const response = await client["workflow-rule"][":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getWorkflowRules;
