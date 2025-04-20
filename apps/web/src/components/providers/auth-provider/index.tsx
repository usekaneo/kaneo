import useGetMe from "@/hooks/queries/use-get-me";
import type { LoggedInUser } from "@/types/user";
import { LayoutGrid } from "lucide-react";
import {
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  createContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const AuthContext = createContext<{
  user: LoggedInUser | null | undefined;
  setUser: Dispatch<SetStateAction<LoggedInUser | null | undefined>>;
}>({
  user: undefined,
  setUser: () => undefined,
});

function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<LoggedInUser | undefined | null>(undefined);
  const { data, isFetching } = useGetMe();

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

  if (isFetching || user === undefined) {
    return (
      <div className="flex w-full items-center justify-center h-screen flex-col md:flex-row bg-zinc-50 dark:bg-zinc-950">
        <div className="p-1.5 bg-linear-to-br from-indigo-500 to-purple-500 rounded-lg shadow-xs animate-spin">
          <LayoutGrid className="w-5 h-5 text-white" />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={memoizedValues}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
