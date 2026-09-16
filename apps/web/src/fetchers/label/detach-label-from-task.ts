import { client } from "@kaneo/libs";

export type DetachLabelFromTaskRequest = {
  labelId: string;
};

async function detachLabelFromTask({ labelId }: DetachLabelFromTaskRequest) {
  const response = await client.label[":id"].task.$delete({
    param: { id: labelId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default detachLabelFromTask;
