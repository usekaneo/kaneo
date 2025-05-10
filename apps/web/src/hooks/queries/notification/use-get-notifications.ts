import getNotifications from "@/fetchers/notification/get-notifications";
import { useQuery } from "@tanstack/react-query";

function useGetNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
  });
}

export default useGetNotifications;
