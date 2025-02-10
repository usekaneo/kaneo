import type { SignUpFormValues } from '@/components/auth/sign-up-form';
import signUp from '@/fetchers/user/sign-up';
import { useMutation } from '@tanstack/react-query';

function useSignUp({ email, password, name }: SignUpFormValues) {
  return useMutation({
    mutationFn: () =>
      signUp({
        email,
        password,
        name,
      }),
  });
}

export default useSignUp;
