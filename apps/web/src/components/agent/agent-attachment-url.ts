import { client } from "@kaneo/libs";

export function getAgentAttachmentUrl(
  workspaceId: string,
  attachmentId: string,
) {
  return client.agent[":workspaceId"].attachments[":attachmentId"].content
    .$url({ param: { workspaceId, attachmentId } })
    .toString();
}
