import { useMutation, useQueryClient } from "@tanstack/react-query";
import uploadAvatar from "@/fetchers/user/upload-avatar";
import { authClient } from "@/lib/auth-client";
import { prepareAvatarImage } from "@/lib/prepare-avatar-image";
import invalidateUserProfileQueries from "./invalidate-user-profile-queries";

function useUpdateUserAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const { contentType, data } = await prepareAvatarImage(file);
      const avatar = await uploadAvatar({ contentType, data });

      const { error } = await authClient.updateUser({ image: avatar.url });

      if (error) {
        throw new Error(error.message || "Failed to update profile picture");
      }

      return avatar;
    },
    onSuccess: () => invalidateUserProfileQueries(queryClient),
  });
}

export default useUpdateUserAvatar;
