import { client } from "@kaneo/libs";

async function getExternalLinks(taskId: string) {
  const response = await client["external-link"].task[":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default getExternalLinks;
