import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import useCreateWorkspace from "@/hooks/queries/workspace/use-create-workspace";
import { useUserPreferencesStore } from "@/store/user-preferences";

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
  const { setActiveWorkspaceId } = useUserPreferencesStore();
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

      setActiveWorkspaceId(createdWorkspace.id);
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
      <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-md">
          <Card className="border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-700 rounded-lg flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
                  </div>
                </div>

                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">
                  Create a new workspace
                </h1>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                  Workspaces are shared environments where teams can work on
                  projects, cycles and issues.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="workspace-name"
                      className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                    >
                      Workspace Name
                    </label>
                    <Input
                      ref={inputRef}
                      id="workspace-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter workspace name"
                      className="h-12 text-lg font-medium border-zinc-300 dark:border-zinc-600 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                      required
                    />
                    {!name.trim() && (
                      <p className="text-red-500 text-sm mt-1">Required</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="workspace-description"
                      className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                    >
                      Description (optional)
                    </label>
                    <Input
                      id="workspace-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add a description for your workspace"
                      className="h-10 border-zinc-300 dark:border-zinc-600 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={!name.trim() || isPending}
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
