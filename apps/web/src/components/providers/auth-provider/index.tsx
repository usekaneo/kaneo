import { authClient } from "@/lib/auth-client";
import type { User } from "@/types/user";
import {
  type PropsWithChildren,
  createContext,
  useEffect,
  useState,
} from "react";
import { ErrorDisplay } from "../../ui/error-display";
import { LoadingSkeleton } from "../../ui/loading-skeleton";

export const AuthContext = createContext<{
  user: User | null | undefined;
  isLoading: boolean;
}>({
  user: undefined,
  isLoading: true,
});

function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUserState] = useState<User | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const getSession = async () => {
      try {
        const session = await authClient.getSession();
        setUserState(session.data?.user || null);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to get session"),
        );
        setUserState(null);
      } finally {
        setIsLoading(false);
      }
    };

    getSession();
  }, []);

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        title="Connection Error"
        className="min-h-screen"
      />
    );
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
