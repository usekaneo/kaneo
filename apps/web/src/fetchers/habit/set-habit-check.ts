import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function setHabitCheck({
  id,
  date,
  done,
}: {
  id: string;
  date: string;
  done: boolean;
}) {
  const endpoint = client.habit[":id"].check[":date"];
  const response = await (done ? endpoint.$put : endpoint.$delete)({
    param: { id, date },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default setHabitCheck;
