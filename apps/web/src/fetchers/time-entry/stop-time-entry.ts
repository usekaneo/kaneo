import { client } from "@kaneo/libs";

async function stopTimeEntry(id: string) {
  const response = await client["time-entry"][":id"].stop.$post({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default stopTimeEntry;
