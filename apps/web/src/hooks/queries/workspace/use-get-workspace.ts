import getWorkspace from "@/fetchers/workspace/get-workspace";
import { useQuery } from "@tanstack/react-query";

function useGetWorkspace({ id }: { id: string }) {
  return useQuery({
    queryKey: [`workspace-${id}`],
    enabled: !!id,
    queryFn: () => getWorkspace({ id }),
  });
}

export default useGetWorkspace;
