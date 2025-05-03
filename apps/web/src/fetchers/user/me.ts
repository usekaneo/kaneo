import { client } from "@kaneo/libs";

const me = async () => {
  const response = await client.me.$get();

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
};

export default me;
