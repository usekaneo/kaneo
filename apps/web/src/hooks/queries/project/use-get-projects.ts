import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";

export const createProjectQueryOptions = () => {
  return trpc.project.list.queryOptions();
};

function useGetProjects() {
  return useQuery(createProjectQueryOptions());
}

export default useGetProjects;
