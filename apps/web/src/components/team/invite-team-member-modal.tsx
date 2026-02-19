import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import useInviteWorkspaceUser from "@/hooks/mutations/workspace-user/use-invite-workspace-user";
import { toast } from "@/lib/toast";
import { Route } from "@/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/members";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogPopup, DialogTitle } from "../ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";

type Props = {
  open: boolean;
  onClose: () => void;
};

const teamMemberSchema = z.object({
  email: z.string(),
});

type TeamMemberFormValues = z.infer<typeof teamMemberSchema>;

function InviteTeamMemberModal({ open, onClose }: Props) {
  const { mutateAsync } = useInviteWorkspaceUser();
  const queryClient = useQueryClient();
  const { workspaceId } = Route.useParams();

  const form = useForm<TeamMemberFormValues>({
    resolver: standardSchemaResolver(teamMemberSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async ({ email }: TeamMemberFormValues) => {
    try {
      await mutateAsync({ email, workspaceId, role: "member" }); // TODO: role and email
      await queryClient.refetchQueries({
        queryKey: ["workspace-users", workspaceId],
      });

      toast.success("Invitation sent successfully");

      resetInviteTeamMember();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to invite team member",
      );
    }
  };

  const resetInviteTeamMember = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["workspace-users", workspaceId],
    });
    form.reset();
  };

  const resetAndCloseModal = () => {
    resetInviteTeamMember();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndCloseModal}>
      <DialogPopup className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <DialogTitle className="text-lg font-semibold text-foreground">
              Invite Team Member
            </DialogTitle>
            <DialogClose
              className="text-muted-foreground hover:text-foreground"
              render={<button type="button" />}
            >
              <X size={20} />
            </DialogClose>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-4">
              <div className="space-y-4">
                <div>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-foreground mb-1">
                          Email
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="colleague@company.com"
                            className="bg-card/50"
                            autoFocus
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <DialogClose
                  render={
                    <Button
                      className="bg-muted text-foreground hover:bg-accent"
                      type="button"
                    />
                  }
                >
                  Cancel
                </DialogClose>
                <Button type="submit">Send Invitation</Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogPopup>
    </Dialog>
  );
}

export default InviteTeamMemberModal;
