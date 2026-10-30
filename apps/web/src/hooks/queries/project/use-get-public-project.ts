import { useState } from "react";
import type getPublicProjectType from "@/fetchers/project/get-public-project";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import getPublicProject from "@/fetchers/project/get-public-project";

function useGetPublicProject(id: string) {
  const queryClient = useQueryClient();
  const [progress, setProgress] =
    useState<Awaited<ReturnType<typeof getPublicProjectType>>>();
  const query = useQuery({
    queryKey: ["public-project", id],
    queryFn: async ({ signal }) => {
      setProgress(undefined);
      const hasCachedBoard = !!queryClient.getQueryData(["public-project", id]);
      try {
        return await getPublicProject({ id }, signal, (board) => {
          if (!hasCachedBoard) setProgress(board);
        });
      } finally {
        setProgress(undefined);
      }
    },
    refetchOnMount: true,
  });
  return {
    ...query,
    data: query.data ?? (query.isFetching ? progress : undefined),
  };
}

export default useGetPublicProject;
