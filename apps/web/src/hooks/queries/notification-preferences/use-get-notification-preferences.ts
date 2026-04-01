import { useQuery } from "@tanstack/react-query";
import getNotificationPreferences from "@/fetchers/notification-preferences/get-notification-preferences";

function useGetNotificationPreferences() {
  return useQuery({
    queryFn: getNotificationPreferences,
    queryKey: ["notification-preferences"],
  });
}

export default useGetNotificationPreferences;
