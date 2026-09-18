import { client } from "@kaneo/libs";

async function setTaskOrder(
  workspaceId: string,
  userId: string,
  taskIds: string[],
) {
  const response = await client.people[":userId"].tasks.order.$put({
    param: { userId },
    json: { workspaceId, taskIds },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default setTaskOrder;
