import { authClient } from "@/lib/auth-client";
import { useMutation } from "@tanstack/react-query";

function useSignIn() {
  return useMutation({
    mutationFn: async ({
      email,
      password,
    }: { email: string; password: string }) => {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });
}

export default useSignIn;
