import signOut from "@/fetchers/user/sign-out";
import { useMutation } from "@tanstack/react-query";

function useSignOut() {
  return useMutation({
    mutationFn: signOut,
  });
}

export default useSignOut;
