import { Loader2 } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DirectoryAvatar } from "@/components/admin/directory/directory-avatar";
import { Button } from "@/components/ui/button";
import useRemoveAdminUserAvatar from "@/hooks/mutations/admin/use-remove-admin-user-avatar";
import useSetAdminUserAvatar from "@/hooks/mutations/admin/use-set-admin-user-avatar";
import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import { ACCEPTED_AVATAR_TYPES } from "@/lib/prepare-avatar-image";

const KANEO_UPLOAD_PREFIX = "/api/user/avatar/";

type UserAvatarFieldProps = {
  user: AdminUser;
};

/**
 * Change or remove another user's picture. As in self-service, a picture
 * the identity provider manages can't be replaced, only a Kaneo upload removed.
 */
export function UserAvatarField({ user }: UserAvatarFieldProps) {
  const { t } = useTranslation();
  const { data: config } = useGetConfig();
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState(user.image);
  const { mutateAsync: setAvatar, isPending: isUploading } =
    useSetAdminUserAvatar();
  const { mutateAsync: removeAvatar, isPending: isRemoving } =
    useRemoveAdminUserAvatar();
  const isBusy = isUploading || isRemoving;
  const managed =
    user.signInMethods.includes("custom") &&
    Boolean(config?.customOAuthManagedProfileFields?.includes("image"));
  const canRemove = managed
    ? Boolean(image?.startsWith(KANEO_UPLOAD_PREFIX))
    : Boolean(image);

  const handleSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const result = await setAvatar({ userId: user.id, file });
      setImage(result.image);
    } catch {
      return;
    }
  };

  const handleRemove = async () => {
    try {
      await removeAvatar(user.id);
      setImage(null);
    } catch {
      return;
    }
  };

  return (
    <div className="flex items-center gap-3">
      <DirectoryAvatar name={user.name} image={image} className="size-10" />
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={isBusy}
            onClick={handleRemove}
          >
            {t("settings:adminUsers.details.removeAvatar")}
          </Button>
        ) : null}
        {managed ? null : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_AVATAR_TYPES}
              className="hidden"
              aria-label={t("settings:adminUsers.details.uploadAvatar")}
              onChange={handleSelected}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? <Loader2 className="animate-spin" /> : null}
              {t("settings:adminUsers.details.uploadAvatar")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
