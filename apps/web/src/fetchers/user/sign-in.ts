import type { SignInFormValues } from '@/components/auth/sign-in-form';
import { api } from '@kaneo/libs';

const signIn = async ({ email, password }: SignInFormValues) => {
  const response = await api.user['sign-in'].post({
    email,
    password,
  });

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response;
};

export default signIn;
