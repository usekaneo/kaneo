import { useQuery } from "@tanstack/react-query";
import { getConfig } from "@/fetchers/config/get-config";

function useGetConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: getConfig,
  });
}

export default useGetConfig;
