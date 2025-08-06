import useGetMe from "@/hooks/queries/use-get-me";
import type { LoggedInUser } from "@/types/user";
import {
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  createContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ErrorDisplay } from "../../ui/error-display";
import { LoadingSkeleton } from "../../ui/loading-skeleton";

export const AuthContext = createContext<{
  user: LoggedInUser | null | undefined;
  setUser: Dispatch<SetStateAction<LoggedInUser | null | undefined>>;
}>({
  user: undefined,
  setUser: () => undefined,
});

function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<LoggedInUser | undefined | null>(undefined);
  const { data, isFetching, error } = useGetMe();

  useEffect(() => {
    if (data?.user === null) {
      setUser(null);
    } else if (data?.user) {
      setUser({ ...data?.user });
    }
  }, [data]);

  const memoizedValues = useMemo(
    () => ({
      user,
      setUser,
    }),
    [user],
  );

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        title="Connection Error"
        className="min-h-screen"
      />
    );
  }

  if (isFetching || user === undefined) {
    return <LoadingSkeleton />;
  }

  return (
    <AuthContext.Provider value={memoizedValues}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
