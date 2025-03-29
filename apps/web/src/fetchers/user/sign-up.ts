import type { SignUpFormValues } from "@/components/auth/sign-up-form";
import { client } from "@kaneo/libs";

const signUp = async ({ email, password, name }: SignUpFormValues) => {
  const response = await client.user["sign-up"].$post({
    json: {
      email,
      password,
      name,
    },
  });

  const user = await response.json();

  return user;
};

export default signUp;
