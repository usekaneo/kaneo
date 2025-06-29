import { getConfig } from "@/fetchers/config/get-config";
import { useQuery } from "@tanstack/react-query";

function useGetConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: getConfig,
  });
}

export default useGetConfig;
