import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function updateColumn(
  id: string,
  data: {
    name?: string;
    icon?: string | null;
    color?: string | null;
    isFinal?: boolean;
  },
) {
  const response = await client.column[":id"].$put({
    param: { id },
    json: data,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateColumn;
