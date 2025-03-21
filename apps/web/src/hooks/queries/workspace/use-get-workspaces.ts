import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { useQuery } from "@tanstack/react-query";

function useGetWorkspaces() {
  const { user } = useAuth();

  return useQuery({
    queryFn: () => getWorkspaces(),
    queryKey: ["workspaces", user?.email],
    enabled: !!user?.email,
  });
}

export default useGetWorkspaces;
