import { useQuery } from "@tanstack/react-query";
import { getMcpAuthorizationRequest } from "@/fetchers/mcp/get-authorization-request";

export function useMcpAuthorizationRequest(requestId: string) {
  return useQuery({
    queryKey: ["mcp-authorization-request", requestId],
    queryFn: () => getMcpAuthorizationRequest(requestId),
    enabled: Boolean(requestId),
    retry: false,
  });
}
