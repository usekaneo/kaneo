import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUpIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setAdminUserAvatar } from "@/fetchers/admin/set-admin-user-avatar";
import { ADMIN_USERS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-users";
import { prepareAvatarImage } from "@/lib/prepare-avatar-image";
import { toast } from "@/lib/toast";

function useSetAdminUserAvatar() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, file }: { userId: string; file: File }) =>
      setAdminUserAvatar({ userId, ...(await prepareAvatarImage(file)) }),
    onSuccess: () => {
      toast.success(t("settings:adminUsers.toast.avatarChanged"), {
        icon: ImageUpIcon,
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminUsers.toast.avatarError"),
      );
    },
  });
}

export default useSetAdminUserAvatar;
