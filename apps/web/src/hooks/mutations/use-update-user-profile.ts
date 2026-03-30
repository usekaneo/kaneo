import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type UpdateUserProfileRequest = {
  name?: string;
  locale?: string;
};

function useUpdateUserProfile() {
  return useMutation({
    mutationFn: async ({ name, locale }: UpdateUserProfileRequest) => {
      const { data, error } = await authClient.updateUser({
        name,
        locale,
      });

      if (error) {
        throw new Error(error.message || "Failed to update user profile");
      }

      return data;
    },
  });
}

export default useUpdateUserProfile;
