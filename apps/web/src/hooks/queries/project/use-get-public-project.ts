import { useQuery } from "@tanstack/react-query";
import getPublicProject from "@/fetchers/project/get-public-project";

function useGetPublicProject(id: string) {
  return useQuery({
    queryKey: ["public-project", id],
    queryFn: ({ signal }) => getPublicProject({ id }, signal),
    refetchOnMount: true,
  });
}

export default useGetPublicProject;
