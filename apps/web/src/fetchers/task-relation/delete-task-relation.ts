import { client } from "@kaneo/libs";

async function deleteTaskRelation(id: string) {
  const response = await client["task-relation"][":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default deleteTaskRelation;
