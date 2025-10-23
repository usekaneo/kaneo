import { useQuery } from "@tanstack/react-query";
import getPublicProject from "@/fetchers/project/get-public-project";

function useGetPublicProject(id: string) {
  return useQuery({
    queryKey: ["public-project", id],
    queryFn: () => getPublicProject({ id }),
  });
}

export default useGetPublicProject;
