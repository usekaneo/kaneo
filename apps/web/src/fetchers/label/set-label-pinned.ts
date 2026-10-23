import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function setLabelPinned({ id, pinned }: { id: string; pinned: boolean }) {
  const endpoint = client.label[":id"].pin;
  const response = await (pinned ? endpoint.$put : endpoint.$delete)({
    param: { id },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default setLabelPinned;
