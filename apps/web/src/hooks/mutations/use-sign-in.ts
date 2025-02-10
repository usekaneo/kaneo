import type { SignInFormValues } from '@/components/auth/sign-in-form';
import signIn from '@/fetchers/user/sign-in';
import { useMutation } from '@tanstack/react-query';

function useSignIn({ email, password }: SignInFormValues) {
  return useMutation({
    mutationFn: () =>
      signIn({
        email,
        password,
      }),
  });
}

export default useSignIn;
