import { useQuery } from "@tanstack/react-query";
import getCompanySettings from "@/fetchers/company/get-company-settings";

function useCompanySettings(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["company-settings", workspaceId],
    queryFn: () => getCompanySettings(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });
}

export default useCompanySettings;
