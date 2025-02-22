import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import useSignOut from "@/hooks/mutations/use-sign-out";
import useProjectStore from "@/store/project";
import useWorkspaceStore from "@/store/workspace";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

function SignOutButton() {
  const { setUser } = useAuth();
  const { setProject } = useProjectStore();
  const { setWorkspace } = useWorkspaceStore();
  const { mutateAsync, isPending } = useSignOut();
  const queryClient = useQueryClient();
  const { history } = useRouter();

  const handleSignOut = async () => {
    await mutateAsync();
    queryClient.clear();
    setUser(null);
    setProject(undefined);
    setWorkspace(undefined);
    history.push("/auth/sign-in");
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleSignOut}
      className="flex-1 px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg flex items-center justify-center transition-colors"
    >
      <LogOut className="w-3 h-3 mr-1" />
      Sign out
    </button>
  );
}

export default SignOutButton;
