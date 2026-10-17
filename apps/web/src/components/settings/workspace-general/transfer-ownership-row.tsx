import { CrownIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useTransferWorkspaceOwnership from "@/hooks/mutations/workspace/use-transfer-workspace-ownership";
import { toast } from "@/lib/toast";

type OwnershipCandidate = {
  id: string;
  user: { name: string; email: string };
};

type TransferOwnershipRowProps = {
  workspaceId: string | undefined;
  workspaceName: string;
  currentOwnerMemberId: string | undefined;
  candidates: OwnershipCandidate[];
};

export function TransferOwnershipRow({
  workspaceId,
  workspaceName,
  currentOwnerMemberId,
  candidates,
}: TransferOwnershipRowProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);
  const { mutateAsync: transferOwnership, isPending } =
    useTransferWorkspaceOwnership();
  const selected = candidates.find((member) => member.id === selectedId);
  const selectedName = selected
    ? selected.user.name || selected.user.email
    : "";
  const hasCandidates = candidates.length > 0;

  const handleTransfer = async () => {
    if (!workspaceId || !currentOwnerMemberId || !selected) return;

    try {
      await transferOwnership({
        workspaceId,
        newOwnerMemberId: selected.id,
        currentOwnerMemberId,
      });
      toast.success(
        t("settings:workspaceGeneral.transferOwnership.toastSuccess"),
        { icon: CrownIcon },
      );
      setOpen(false);
      setSelectedId("");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceGeneral.transferOwnership.toastError"),
      );
    }
  };

  return (
    <SettingsRow
      stack
      title={t("settings:workspaceGeneral.transferOwnership.title")}
      description={
        hasCandidates
          ? t("settings:workspaceGeneral.transferOwnership.pickerHint")
          : t("settings:workspaceGeneral.transferOwnership.noEligibleMembers")
      }
    >
      <Select
        value={selectedId}
        onValueChange={(value) => {
          if (typeof value === "string") setSelectedId(value);
        }}
        disabled={!hasCandidates}
      >
        <SelectTrigger
          size="sm"
          className="sm:w-48"
          aria-label={t(
            "settings:workspaceGeneral.transferOwnership.pickerLabel",
          )}
        >
          <SelectValue
            placeholder={t(
              "settings:workspaceGeneral.transferOwnership.pickerPlaceholder",
            )}
          >
            {selected ? selectedName : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {candidates.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.user.name} ({member.user.email})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!selected || isPending}
        onClick={() => setOpen(true)}
      >
        {t("settings:workspaceGeneral.transferOwnership.button")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive={false}
        title={t("settings:workspaceGeneral.transferOwnership.dialogTitle")}
        description={t(
          "settings:workspaceGeneral.transferOwnership.dialogDescription",
          { name: selectedName, workspace: workspaceName },
        )}
        confirmLabel={t("settings:workspaceGeneral.transferOwnership.confirm")}
        pendingLabel={t(
          "settings:workspaceGeneral.transferOwnership.transferring",
        )}
        pending={isPending}
        confirmDisabled={!selected}
        onConfirm={handleTransfer}
      />
    </SettingsRow>
  );
}
