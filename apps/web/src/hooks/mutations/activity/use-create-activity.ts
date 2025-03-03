import createActivity from "@/fetchers/activity/create-activity";
import { useMutation } from "@tanstack/react-query";

function useCreateActivity() {
  return useMutation({
    mutationFn: createActivity,
  });
}

export default useCreateActivity;
