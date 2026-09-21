import { client } from "@kaneo/libs";

async function getRunningTimeEntry() {
  const response = await client["time-entry"].running.me.$get();

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

export default getRunningTimeEntry;
