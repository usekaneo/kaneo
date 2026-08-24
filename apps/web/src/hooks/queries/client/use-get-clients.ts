import { useQuery } from "@tanstack/react-query";
import getClients from "@/fetchers/client/get-clients";

function useGetClients({ workspaceId }: { workspaceId: string }) {
  return useQuery({
    queryFn: () => getClients({ workspaceId }),
    queryKey: ["clients", workspaceId],
    enabled: !!workspaceId,
  });
}

export default useGetClients;
