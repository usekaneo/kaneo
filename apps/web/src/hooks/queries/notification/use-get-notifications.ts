import { useQuery } from "@tanstack/react-query";
import getNotifications from "@/fetchers/notification/get-notifications";
import {
  getVisibleTabRefetchInterval,
  visibleTabRefetchDefaults,
} from "@/lib/get-visible-tab-refetch-interval";

function useGetNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    refetchInterval: getVisibleTabRefetchInterval(10000),
    ...visibleTabRefetchDefaults,
  });
}

export default useGetNotifications;
