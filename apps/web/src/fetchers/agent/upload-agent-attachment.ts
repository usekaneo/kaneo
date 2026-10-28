import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";
import { readFileAsBase64 } from "@/lib/read-file-as-base64";
import type { AgentUploadMediaType } from "@/types/agent";

async function uploadAgentAttachment(
  workspaceId: string,
  input: { name: string; mediaType: string; file: File },
) {
  const response = await client.agent[":workspaceId"].attachments.$post({
    param: { workspaceId },
    json: {
      name: input.name,
      // The server rejects any type outside its allowlist.
      mediaType: input.mediaType as AgentUploadMediaType,
      data: await readFileAsBase64(input.file),
    },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default uploadAgentAttachment;
