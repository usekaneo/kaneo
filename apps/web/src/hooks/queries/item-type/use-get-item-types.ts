import { useQuery } from "@tanstack/react-query";
import getItemTypes from "@/fetchers/item-type/get-item-types";

function useGetItemTypes(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: ["item-types", workspaceId],
    queryFn: () => getItemTypes({ workspaceId }),
  });
}

export default useGetItemTypes;
