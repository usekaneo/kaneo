import { client } from "@kaneo/libs";

const signOut = async () => {
  const response = await client.user["sign-out"].$post();

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
};

export default signOut;
