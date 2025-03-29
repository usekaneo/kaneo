import { client } from "@kaneo/libs";

const me = async () => {
  const response = await client.me.$get();

  const data = await response.json();

  return data;
};

export default me;
