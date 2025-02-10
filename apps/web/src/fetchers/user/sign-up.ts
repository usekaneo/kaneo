import type { SignUpFormValues } from '@/components/auth/sign-up-form';
import { api } from '@kaneo/libs';

const signUp = async ({ email, password, name }: SignUpFormValues) => {
  const response = await api.user['sign-up'].post({
    email,
    password,
    name,
  });

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response;
};

export default signUp;
