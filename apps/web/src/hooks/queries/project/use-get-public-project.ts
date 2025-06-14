import getPublicProject from "@/fetchers/project/get-public-project";
import { useQuery } from "@tanstack/react-query";

function useGetPublicProject(id: string) {
  return useQuery({
    queryKey: ["public-project", id],
    queryFn: () => getPublicProject({ id }),
  });
}

export default useGetPublicProject;
