import { authClient } from "@/lib/auth-client";
import { useMutation } from "@tanstack/react-query";

function useSignUp() {
  return useMutation({
    mutationFn: async ({
      email,
      password,
      name,
    }: { email: string; password: string; name: string }) => {
      const result = await authClient.signUp.email({ email, password, name });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });
}

export default useSignUp;
