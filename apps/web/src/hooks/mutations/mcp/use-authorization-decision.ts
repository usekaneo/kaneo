import { useMutation } from "@tanstack/react-query";
import { submitMcpAuthorizationDecision } from "@/fetchers/mcp/submit-authorization-decision";
import { toast } from "@/lib/toast";

export function useMcpAuthorizationDecision() {
  return useMutation({
    mutationFn: ({
      requestId,
      approved,
    }: {
      requestId: string;
      approved: boolean;
    }) => submitMcpAuthorizationDecision(requestId, approved),
    onError: (error) => toast.error(error.message),
  });
}
