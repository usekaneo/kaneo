import { client } from "@kaneo/libs";

const signOut = async () => {
  const response = await client.user["sign-out"].$post();

  const { message } = await response.json();

  return message;
};

export default signOut;
