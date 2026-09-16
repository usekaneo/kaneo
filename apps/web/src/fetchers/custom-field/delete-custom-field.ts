import { client } from "@kaneo/libs";

async function deleteCustomField({ id }: { id: string }) {
  const response = await client["custom-field"][":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteCustomField;
