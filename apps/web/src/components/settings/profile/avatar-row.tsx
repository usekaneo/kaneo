import { Loader2, ImageMinusIcon, ImageUpIcon } from "lucide-react";
import { type ChangeEvent, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import useRemoveUserAvatar from "@/hooks/mutations/use-remove-user-avatar";
import useUpdateUserAvatar from "@/hooks/mutations/use-update-user-avatar";
import { getInitials } from "@/lib/get-initials";
import { ACCEPTED_AVATAR_TYPES } from "@/lib/prepare-avatar-image";
import { toast } from "@/lib/toast";

type AvatarRowProps = {
  name: string | undefined;
  image: string | null | undefined;
  refetchUser: () => Promise<unknown>;
};

export function AvatarRow({ name, image, refetchUser }: AvatarRowProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: updateAvatar, isPending: isUploading } =
    useUpdateUserAvatar();
  const { mutateAsync: removeAvatar, isPending: isRemoving } =
    useRemoveUserAvatar();
  const isBusy = isUploading || isRemoving;

  const handleSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      await updateAvatar(file);
      await refetchUser();
      toast.success(t("settings:informationPage.avatar.updateSuccess"), {
        icon: ImageUpIcon,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:informationPage.avatar.updateError"),
      );
    }
  };

  const handleRemove = async () => {
    try {
      await removeAvatar();
      await refetchUser();
      toast.success(t("settings:informationPage.avatar.removeSuccess"), {
        icon: ImageMinusIcon,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:informationPage.avatar.removeError"),
      );
    }
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <Avatar className="size-10">
          <AvatarImage src={image ?? ""} alt="" />
          <AvatarFallback className="border border-border/30 text-xs font-medium">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm font-medium">
            {t("settings:informationPage.profilePicture")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("settings:informationPage.avatar.hint")}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_AVATAR_TYPES}
          className="hidden"
          onChange={handleSelected}
        />
        {image ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={isBusy}
            onClick={handleRemove}
          >
            {t("settings:informationPage.avatar.remove")}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-24"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? <Loader2 className="animate-spin" /> : null}
          {t("settings:informationPage.avatar.upload")}
        </Button>
      </div>
    </div>
  );
}
