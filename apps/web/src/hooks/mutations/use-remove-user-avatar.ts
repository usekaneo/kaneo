import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteAvatar from "@/fetchers/user/delete-avatar";
import { authClient } from "@/lib/auth-client";
import invalidateUserProfileQueries from "./invalidate-user-profile-queries";

function useRemoveUserAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await authClient.updateUser({ image: null });

      if (error) {
        throw new Error(error.message || "Failed to remove profile picture");
      }

      return deleteAvatar();
    },
    onSuccess: () => invalidateUserProfileQueries(queryClient),
  });
}

export default useRemoveUserAvatar;
