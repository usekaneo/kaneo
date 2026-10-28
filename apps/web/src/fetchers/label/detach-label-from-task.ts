import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";
export type DetachLabelFromTaskRequest = {
  labelId: string;
};

async function detachLabelFromTask({ labelId }: DetachLabelFromTaskRequest) {
  const response = await client.label[":id"].task.$delete({
    param: { id: labelId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default detachLabelFromTask;
