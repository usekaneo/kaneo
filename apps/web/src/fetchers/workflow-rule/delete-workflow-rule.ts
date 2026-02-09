import { client } from "@kaneo/libs";

async function deleteWorkflowRule(id: string) {
  const response = await client["workflow-rule"][":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteWorkflowRule;
