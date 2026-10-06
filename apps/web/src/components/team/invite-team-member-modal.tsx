import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import useInviteWorkspaceUser from "@/hooks/mutations/workspace-user/use-invite-workspace-user";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useGetMyProjectAccess from "@/hooks/queries/workspace-users/use-get-my-project-access";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import InvitationLinkField from "./invitation-link-field";
import {
  ALL_PROJECTS_ACCESS,
  type ProjectAccessValue,
  SELECTED_PROJECTS_ACCESS,
} from "./project-access/project-access-value";
import { isProjectAccessComplete } from "./project-access/is-project-access-complete";
import { toProjectAccessRequest } from "./project-access/to-project-access-request";
import ProjectAccessFields from "./project-access-fields";

type Props = {
  open: boolean;
  onClose: () => void;
};

const teamMemberSchema = z.object({
  email: z.string(),
});

type TeamMemberFormValues = z.infer<typeof teamMemberSchema>;

function InviteTeamMemberModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { mutateAsync } = useInviteWorkspaceUser();
  const queryClient = useQueryClient();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;
  const { canInviteUsers } = useWorkspacePermission();
  const canInvite = canInviteUsers();
  const [createdInvitation, setCreatedInvitation] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const myAccess = useGetMyProjectAccess(workspaceId ?? "", open);
  const isMyAccessPending = myAccess.isPending;
  const inviterLimited =
    myAccess.isError || myAccess.data?.projectAccess === "selected";
  const [chosenAccess, setProjectAccess] = useState<ProjectAccessValue | null>(
    null,
  );
  const projectAccess =
    chosenAccess ??
    (inviterLimited ? SELECTED_PROJECTS_ACCESS : ALL_PROJECTS_ACCESS);
  const [showProjectAccessError, setShowProjectAccessError] = useState(false);
  const { data: projects, isLoading: isLoadingProjects } = useGetProjects({
    workspaceId: workspaceId ?? "",
    includeArchived: true,
    enabled: open,
  });

  const form = useForm<TeamMemberFormValues>({
    resolver: standardSchemaResolver(teamMemberSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async ({ email }: TeamMemberFormValues) => {
    if (!workspaceId) {
      toast.error(t("team:inviteModal.error"));
      return;
    }
    if (!canInvite) {
      // Defense-in-depth: parent gates the trigger, but if the modal is
      // somehow open without permission we refuse rather than firing a
      // mutation the server will reject.
      toast.error(t("team:inviteModal.error"));
      return;
    }
    const access = toProjectAccessRequest(
      projectAccess,
      (projects ?? []).map((project) => project.id),
    );
    if (!isProjectAccessComplete(access)) {
      setShowProjectAccessError(true);
      return;
    }
    try {
      const invitation = await mutateAsync({
        email,
        workspaceId,
        role: "member",
        ...access,
      }); // TODO: role and email
      await queryClient.refetchQueries({
        queryKey: ["workspace-users", workspaceId],
      });

      toast.success(t("team:inviteModal.success"));

      // The link is the only delivery channel when SMTP is unconfigured, so the
      // modal stays open on it instead of closing. If the API ever stops
      // returning an id, fall back to the previous close-on-success behaviour.
      if (invitation?.id) {
        setCreatedInvitation({ id: invitation.id, email });
        form.reset();
        setProjectAccess(null);
        return;
      }

      closeModal();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("team:inviteModal.error"),
      );
    }
  };

  const closeModal = () => {
    if (workspaceId) {
      void queryClient.invalidateQueries({
        queryKey: ["workspace-users", workspaceId],
      });
    }
    onClose();
  };

  const resetAfterClose = (isOpen: boolean) => {
    if (isOpen) return;
    setCreatedInvitation(null);
    form.reset();
    setProjectAccess(null);
    setShowProjectAccessError(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeModal();
      }}
      onOpenChangeComplete={resetAfterClose}
    >
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>
            {createdInvitation
              ? t("team:inviteModal.createdTitle")
              : t("team:inviteModal.title")}
          </DialogTitle>
        </DialogHeader>

        {createdInvitation ? (
          <>
            <DialogPanel className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("team:inviteModal.shareLinkDescription", {
                  email: createdInvitation.email,
                })}
              </p>
              <InvitationLinkField invitationId={createdInvitation.id} />
            </DialogPanel>
            <DialogFooter>
              <Button size="sm" onClick={closeModal}>
                {t("team:inviteModal.done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="contents">
              <DialogPanel className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("team:inviteModal.emailLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t("team:inviteModal.emailPlaceholder")}
                          autoFocus
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <ProjectAccessFields
                  allowAll={!inviterLimited}
                  value={projectAccess}
                  onChange={(next) => {
                    setProjectAccess(next);
                    setShowProjectAccessError(false);
                  }}
                  projects={projects}
                  isLoadingProjects={isLoadingProjects}
                  disabled={form.formState.isSubmitting || isMyAccessPending}
                  error={
                    showProjectAccessError
                      ? t("team:projectAccess.selectAtLeastOne")
                      : undefined
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
                  type="submit"
                  size="sm"
                  disabled={!workspaceId || !canInvite || isMyAccessPending}
                >
                  {t("team:inviteModal.sendInvitation")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogPopup>
    </Dialog>
  );
}

export default InviteTeamMemberModal;
