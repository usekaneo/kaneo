import { useState } from "react";
import { useTranslation } from "react-i18next";
import useUpdateMemberProjectAccess from "@/hooks/mutations/workspace-user/use-update-member-project-access";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useGetMyProjectAccess from "@/hooks/queries/workspace-users/use-get-my-project-access";
import { toast } from "@/lib/toast";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { isProjectAccessComplete } from "./project-access/is-project-access-complete";
import { type ProjectAccessValue } from "./project-access/project-access-value";
import { toProjectAccessRequest } from "./project-access/to-project-access-request";
import ProjectAccessFields from "./project-access-fields";

type Props = {
  workspaceId: string;
  open: boolean;
  member: { userId: string; name: string } | null;
  access: ProjectAccessValue;
  onOpenChange: (open: boolean) => void;
};

function MemberProjectAccessDialog({
  workspaceId,
  open,
  member,
  access,
  onOpenChange,
}: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState(access);
  const [showError, setShowError] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  const { data: projects, isLoading: isLoadingProjects } = useGetProjects({
    workspaceId,
    includeArchived: true,
  });
  const myAccess = useGetMyProjectAccess(workspaceId, open);
  const managerLimited =
    myAccess.isError || myAccess.data?.projectAccess === "selected";
  const { mutateAsync, isPending } = useUpdateMemberProjectAccess();

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValue(access);
      setShowError(false);
    }
  }

  const handleSave = async () => {
    if (!member) return;
    const request = toProjectAccessRequest(
      value,
      (projects ?? []).map((project) => project.id),
    );
    if (!isProjectAccessComplete(request)) {
      setShowError(true);
      return;
    }
    try {
      await mutateAsync({ workspaceId, userId: member.userId, ...request });
      toast.success(t("team:projectAccess.updateSuccess"));
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("team:projectAccess.updateError"),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{t("team:projectAccess.dialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("team:projectAccess.dialogDescription", {
              name: member?.name ?? "",
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <ProjectAccessFields
            allowAll={!managerLimited}
            value={value}
            onChange={(next) => {
              setValue(next);
              setShowError(false);
            }}
            projects={projects}
            isLoadingProjects={isLoadingProjects}
            disabled={isPending || myAccess.isPending}
            error={
              showError ? t("team:projectAccess.selectAtLeastOne") : undefined
            }
          />
        </DialogPanel>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" size="sm" type="button" />}
          >
            {t("common:actions.cancel")}
          </DialogClose>
          <Button
            size="sm"
            type="button"
            disabled={isPending || isLoadingProjects || myAccess.isPending}
            onClick={handleSave}
          >
            {t("team:projectAccess.save")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

export default MemberProjectAccessDialog;
