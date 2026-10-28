import { queryOptions, useQuery } from "@tanstack/react-query";
import { getConfig } from "@/fetchers/config/get-config";

export function configQueryOptions() {
  return queryOptions({
    queryKey: ["config"],
    queryFn: getConfig,
  });
}

function useGetConfig() {
  return useQuery(configQueryOptions());
}

export default useGetConfig;
