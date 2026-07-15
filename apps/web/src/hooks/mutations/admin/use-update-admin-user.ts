import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ADMIN_USERS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-users";
import { authClient } from "@/lib/auth-client";

type UpdateAdminUserRequest = {
  userId: string;
  name: string;
  email: string;
  role: "admin" | "user";
};

function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      name,
      email,
      role,
    }: UpdateAdminUserRequest) => {
      const { data, error } = await authClient.admin.updateUser({
        userId,
        data: { name, email, role },
      });

      if (error) {
        throw new Error(error.message || "Failed to update user");
      }

      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY }),
  });
}

export default useUpdateAdminUser;
