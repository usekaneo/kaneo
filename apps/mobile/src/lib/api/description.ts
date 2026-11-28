import { api } from "./endpoints";

export async function loadDescription(
  taskId: string,
  inline: string | null | undefined,
  deferred: boolean,
): Promise<string> {
  if (!deferred) return inline ?? "";
  let text = "";
  let offset: number | null | undefined = 0;
  let version: string | undefined;
  while (offset !== null && offset !== undefined) {
    const page = await api.descriptionPage(taskId, offset, version);
    version = page.version;
    text += page.content;
    offset = page.nextOffset;
  }
  return text;
}
