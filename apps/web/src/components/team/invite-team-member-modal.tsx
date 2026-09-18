import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import useInviteWorkspaceUser from "@/hooks/mutations/workspace-user/use-invite-workspace-user";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGrantableRoles from "@/hooks/use-grantable-roles";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import { roleLabel } from "../people/labels";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import InvitationLinkField from "./invitation-link-field";

type Props = {
  open: boolean;
  onClose: () => void;
};

const teamMemberSchema = z.object({
  email: z.string(),
  role: z.string().min(1),
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

  const { roles: grantableRoles } = useGrantableRoles(workspaceId);
  const defaultRole = grantableRoles.includes("member")
    ? "member"
    : (grantableRoles[0] ?? "");

  const form = useForm<TeamMemberFormValues>({
    resolver: standardSchemaResolver(teamMemberSchema),
    defaultValues: {
      email: "",
      role: defaultRole,
    },
  });

  // Roles load after the form mounts; fill the default once they arrive
  // without overriding a choice the user already made.
  useEffect(() => {
    if (!form.getValues("role") && defaultRole) {
      form.setValue("role", defaultRole);
    }
  }, [defaultRole, form]);

  const roleHint = (role: string) => {
    switch (role) {
      case "viewer":
        return t("team:inviteModal.roleHint.viewer");
      case "member":
        return t("team:inviteModal.roleHint.member");
      case "manager":
        return t("team:inviteModal.roleHint.manager");
      case "admin":
        return t("team:inviteModal.roleHint.admin");
      default:
        return t("team:inviteModal.roleHint.custom");
    }
  };

  const onSubmit = async ({ email, role }: TeamMemberFormValues) => {
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
    try {
      const invitation = await mutateAsync({
        email,
        workspaceId,
        role,
      });
      await queryClient.refetchQueries({
        queryKey: ["workspace-users", workspaceId],
      });

      toast.success(t("team:inviteModal.success"));

      // The link is the only delivery channel when SMTP is unconfigured, so the
      // modal stays open on it instead of closing. If the API ever stops
      // returning an id, fall back to the previous close-on-success behaviour.
      if (invitation?.id) {
        setCreatedInvitation({ id: invitation.id, email });
        form.reset({ email: "", role: defaultRole });
        return;
      }

      resetInviteTeamMember();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("team:inviteModal.error"),
      );
    }
  };

  const resetInviteTeamMember = async () => {
    if (workspaceId) {
      await queryClient.invalidateQueries({
        queryKey: ["workspace-users", workspaceId],
      });
    }
    form.reset({ email: "", role: defaultRole });
  };

  const resetAndCloseModal = () => {
    setCreatedInvitation(null);
    resetInviteTeamMember();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndCloseModal}>
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
              <Button size="sm" onClick={resetAndCloseModal}>
                {t("team:inviteModal.done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="contents">
              <DialogPanel className="space-y-4">
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
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("team:inviteModal.roleLabel")}</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {field.value ? roleLabel(t, field.value) : null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {grantableRoles.map((role) => (
                              <SelectItem key={role} value={role}>
                                {roleLabel(t, role)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      {field.value ? (
                        <p className="text-xs text-muted-foreground">
                          {roleHint(field.value)}
                        </p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
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
                  disabled={!workspaceId || !canInvite || !form.watch("role")}
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
