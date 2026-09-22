import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getRunningTimeEntry() {
  const response = await client["time-entry"].running.me.$get();

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}

export default getRunningTimeEntry;
