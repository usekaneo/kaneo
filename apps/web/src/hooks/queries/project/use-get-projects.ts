import { getProjects } from "@/fetchers/project/get-projects";
import { useQuery } from "@tanstack/react-query";

function useGetProjects() {
  return useQuery({
    queryFn: () => getProjects(),
    queryKey: ["projects"],
  });
}

export default useGetProjects;
