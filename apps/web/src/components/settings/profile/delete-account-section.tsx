import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { isDeleteConfirmationValid } from "@/components/settings/profile/is-delete-confirmation-valid";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useDeleteAccount, {
  SESSION_TOO_OLD,
} from "@/hooks/mutations/use-delete-account";
import { toast } from "@/lib/toast";

type DeleteAccountSectionProps = {
  email: string | undefined;
};

export function DeleteAccountSection({ email }: DeleteAccountSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const { mutateAsync: deleteAccount, isPending } = useDeleteAccount();
  const canConfirm = isDeleteConfirmationValid(confirmation, email);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setConfirmation("");
  };

  const handleDelete = async () => {
    if (!canConfirm) return;

    try {
      await deleteAccount();
      setOpen(false);
      queryClient.clear();
      toast.success(t("settings:informationPage.deleteAccount.success"), {
        icon: Trash2Icon,
      });
      navigate({ to: "/auth/sign-in" });
    } catch (error) {
      if (error instanceof Error && error.message === SESSION_TOO_OLD) {
        toast.error(t("settings:informationPage.deleteAccount.sessionTooOld"));
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:informationPage.deleteAccount.error"),
      );
    }
  };

  return (
    <SettingsSection
      title={t("settings:informationPage.deleteAccount.sectionTitle")}
    >
      <SettingsCard tone="danger">
        <SettingsRow
          stack
          title={t("settings:informationPage.deleteAccount.title")}
          description={t("settings:informationPage.deleteAccount.description")}
        >
          <Button
            type="button"
            variant="destructive-outline"
            size="sm"
            onClick={() => setOpen(true)}
          >
            {t("settings:informationPage.deleteAccount.title")}
          </Button>
        </SettingsRow>
      </SettingsCard>
      <ConfirmDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={t("settings:informationPage.deleteAccount.modalTitle")}
        description={t(
          "settings:informationPage.deleteAccount.modalDescription",
          {
            email: email ?? "",
          },
        )}
        confirmLabel={t("settings:informationPage.deleteAccount.confirm")}
        pendingLabel={t("common:actions.deleting")}
        pending={isPending}
        confirmDisabled={!canConfirm}
        onConfirm={handleDelete}
      >
        <div className="space-y-2">
          <Label htmlFor={inputId}>
            {t("settings:informationPage.deleteAccount.confirmLabel", {
              email: email ?? "",
            })}
          </Label>
          <Input
            id={inputId}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={isPending}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={email ?? ""}
          />
        </div>
      </ConfirmDialog>
    </SettingsSection>
  );
}
