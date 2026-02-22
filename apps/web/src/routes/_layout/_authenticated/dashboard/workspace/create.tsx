import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import useCreateWorkspace from "@/hooks/queries/workspace/use-create-workspace";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/create",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useCreateWorkspace();

  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, []);

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
        replace: true,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create workspace",
      );
    }
  };

  return (
    <>
      <PageTitle title="Create Workspace" />
      <div className="min-h-screen w-full bg-background flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-md">
          <Card className="shadow-sm">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>

                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  Create a new workspace
                </h1>
                <p className="text-muted-foreground text-sm">
                  Workspaces are shared environments where teams can work on
                  projects, cycles and issues.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="workspace-name"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Workspace Name
                    </label>
                    <Input
                      ref={inputRef}
                      id="workspace-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter workspace name"
                      className="h-12 text-lg font-medium"
                      required
                    />
                    {!name.trim() && (
                      <p className="mt-1 text-destructive-foreground text-sm">
                        Required
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="workspace-description"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Description (optional)
                    </label>
                    <Input
                      id="workspace-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add a description for your workspace"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={!name.trim() || isPending}
                    className="w-full h-12 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? "Creating..." : "Create workspace"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
