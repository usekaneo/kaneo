import getProject from "@/fetchers/project/get-project";
import { useQuery } from "@tanstack/react-query";

function useGetProject({ id }: { id: string }) {
  return useQuery({
    queryFn: () => getProject({ id }),
    queryKey: ["projects", id],
    enabled: !!id,
  });
}

export default useGetProject;
