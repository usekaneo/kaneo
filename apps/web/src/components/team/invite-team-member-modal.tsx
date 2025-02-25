import useInviteWorkspaceUser from "@/hooks/mutations/workspace-user/use-invite-workspace-user";
import { Route } from "@/routes/dashboard/teams/$workspaceId/_layout";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
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
  userEmail: z.string().email(),
});

type TeamMemberFormValues = z.infer<typeof teamMemberSchema>;

function InviteTeamMemberModal({ open, onClose }: Props) {
  const { mutateAsync } = useInviteWorkspaceUser();
  const queryClient = useQueryClient();
  const { workspaceId } = Route.useParams();

  const emailRef = useRef<HTMLInputElement>(null);

  const form = useForm<TeamMemberFormValues>({
    resolver: zodResolver(teamMemberSchema),
    defaultValues: {
      userEmail: "",
    },
  });

  const onSubmit = async ({ userEmail }: TeamMemberFormValues) => {
    await mutateAsync({ userEmail, workspaceId });
    await queryClient.refetchQueries({
      queryKey: ["workspace-users", workspaceId],
    });

    resetInviteTeamMember();
    onClose();
  };

  const resetInviteTeamMember = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workspace-users"] });
    form.reset();
  };

  const resetAndCloseModal = () => {
    resetInviteTeamMember();
    onClose();
  };

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        emailRef.current?.focus();
      });
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={resetAndCloseModal}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Invite Team Member
              </Dialog.Title>
              <Dialog.Close className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300">
                <X size={20} />
              </Dialog.Close>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="p-4">
                <div className="space-y-4">
                  <div>
                    <FormField
                      control={form.control}
                      name="userEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="block text-sm font-medium text-zinc-900 dark:text-zinc-300 mb-1">
                            Email
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              ref={(e) => {
                                field.ref(e);
                                emailRef.current = e;
                              }}
                              placeholder="colleague@company.com"
                              className="bg-white dark:bg-zinc-800/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Dialog.Close asChild>
                    <Button
                      type="button"
                      className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                    >
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button
                    type="submit"
                    className="bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                  >
                    Send Invitation
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default InviteTeamMemberModal;
