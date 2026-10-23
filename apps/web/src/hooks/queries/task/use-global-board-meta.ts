import { useQuery } from "@tanstack/react-query";
import getGlobalBoardMeta from "@/fetchers/task/get-global-board-meta";

function useGlobalBoardMeta({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    enabled,
    queryKey: ["global-board", "meta"],
    queryFn: getGlobalBoardMeta,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
}

export default useGlobalBoardMeta;
