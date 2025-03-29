import type { SignInFormValues } from "@/components/auth/sign-in-form";
import { client } from "@kaneo/libs";

const signIn = async ({ email, password }: SignInFormValues) => {
  const response = await client.user["sign-in"].$post({
    json: {
      email,
      password,
    },
  });

  const user = await response.json();

  return user;
};

export default signIn;
