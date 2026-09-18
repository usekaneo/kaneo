import { client } from "@kaneo/libs";

// The route reads an optional `{ description }` body by hand, so the typed
// client doesn't know about it; pass it through the request init instead.
async function stopTimeEntry(id: string, description?: string) {
  const note = description?.trim();
  const response = await client["time-entry"][":id"].stop.$post(
    { param: { id } },
    note
      ? {
          init: {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: note }),
          },
        }
      : undefined,
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default stopTimeEntry;
