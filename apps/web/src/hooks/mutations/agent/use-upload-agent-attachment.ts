import { useMutation } from "@tanstack/react-query";
import uploadAgentAttachment from "@/fetchers/agent/upload-agent-attachment";

function useUploadAgentAttachment(workspaceId: string) {
  return useMutation({
    mutationFn: (input: { name: string; mediaType: string; file: File }) =>
      uploadAgentAttachment(workspaceId, input),
  });
}

export default useUploadAgentAttachment;
