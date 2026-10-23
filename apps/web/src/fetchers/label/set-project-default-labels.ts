import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function setProjectDefaultLabels({
  projectId,
  labelIds,
}: {
  projectId: string;
  labelIds: string[];
}) {
  const response = await client.label.project[":projectId"].defaults.$put({
    param: { projectId },
    json: { labelIds },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default setProjectDefaultLabels;
