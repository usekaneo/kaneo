import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import useCreateWorkspace from "@/hooks/queries/workspace/use-create-workspace";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

type CreateWorkspaceModalProps = {
  open: boolean;
  onClose: () => void;
};

function CreateWorkspaceModal({ open, onClose }: CreateWorkspaceModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { mutateAsync } = useCreateWorkspace();

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const handleClose = () => {
    setName("");
    setDescription("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const createdWorkspace = await mutateAsync({ name, description });
      toast.success("Workspace created successfully");
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });

      await authClient.organization.setActive({
        organizationId: createdWorkspace.id,
      });

      navigate({
        to: "/dashboard/workspace/$workspaceId",
        params: {
          workspaceId: createdWorkspace.id,
        },
      });

      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create workspace",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle asChild>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="text-muted-foreground font-semibold tracking-wider text-sm">
                  KANEO
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="text-foreground font-medium text-sm">
                  Create a new workspace
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Create a new workspace by providing a name for your workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 px-6">
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              className="!text-2xl font-semibold !border-0 px-0 py-3 !shadow-none focus-visible:!ring-0 !bg-transparent text-foreground placeholder:text-muted-foreground tracking-tight focus:!outline-none focus-visible:!outline-none"
              required
            />

            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description..."
              className="!border-0 px-0 py-2 !shadow-none focus-visible:!ring-0 !bg-transparent text-foreground placeholder:text-muted-foreground focus:!outline-none focus-visible:!outline-none"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              size="sm"
              className="border-border text-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
              size="sm"
              className="disabled:opacity-50"
            >
              Create Workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateWorkspaceModal;
