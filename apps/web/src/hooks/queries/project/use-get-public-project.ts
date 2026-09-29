import { useQuery, useQueryClient } from "@tanstack/react-query";
import getPublicProject from "@/fetchers/project/get-public-project";

function useGetPublicProject(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["public-project", id],
    queryFn: ({ signal }) => {
      const hasCachedBoard = !!queryClient.getQueryData(["public-project", id]);
      return getPublicProject({ id }, signal, (board) => {
        if (!hasCachedBoard)
          queryClient.setQueryData(["public-project", id], board);
      });
    },
    refetchOnMount: true,
  });
}

export default useGetPublicProject;
