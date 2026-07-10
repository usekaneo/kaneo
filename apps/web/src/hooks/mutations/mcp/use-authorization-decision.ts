import { useMutation } from "@tanstack/react-query";
import { submitMcpAuthorizationDecision } from "@/fetchers/mcp/submit-authorization-decision";

export function useMcpAuthorizationDecision() {
  return useMutation({
    mutationFn: ({
      requestId,
      approved,
    }: {
      requestId: string;
      approved: boolean;
    }) => submitMcpAuthorizationDecision(requestId, approved),
  });
}
