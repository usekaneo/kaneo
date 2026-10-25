import { client } from "@kaneo/libs";
import { loadDescriptionPages } from "@/fetchers/task/get-description-pages";
import { HttpError } from "@/lib/http-error";

export async function getSharedTask(token: string, signal?: AbortSignal) {
  const response = await client["shared-task"][":token"].$get(
    { param: { token } },
    { init: { signal } },
  );
  if (!response.ok)
    throw new HttpError(response.status, "Shared task not found");
  return response.json();
}

export async function getSharedTaskDescription(
  token: string,
  signal?: AbortSignal,
) {
  return loadDescriptionPages(async (offset, version) => {
    const response = await client["shared-task"][":token"].description.$get(
      {
        param: { token },
        query: { offset: String(offset), version },
      },
      { init: { signal } },
    );
    if (!response.ok)
      throw new HttpError(response.status, "Failed to load description");
    return response.json();
  }, signal);
}

export type SharedTask = Awaited<ReturnType<typeof getSharedTask>>;
