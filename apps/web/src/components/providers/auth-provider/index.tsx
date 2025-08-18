import { authClient } from "@/lib/auth-client";
import type { User } from "@/types/user";
import { type PropsWithChildren, createContext } from "react";
import { ErrorDisplay } from "../../ui/error-display";
import { LoadingSkeleton } from "../../ui/loading-skeleton";

const { useSession } = authClient;

export const AuthContext = createContext<{
  user: User | null | undefined;
  isLoading: boolean;
}>({
  user: undefined,
  isLoading: true,
});

function AuthProvider({ children }: PropsWithChildren) {
  const { data, error, isPending } = useSession();

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        title="Connection Error"
        className="min-h-screen"
      />
    );
  }

  if (isPending) {
    return <LoadingSkeleton />;
  }

  return (
    <AuthContext.Provider value={{ user: data?.user, isLoading: isPending }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
