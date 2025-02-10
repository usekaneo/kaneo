import { api } from '@kaneo/libs';

const me = async () => {
  const response = await api.me.get();

  return response;
};

export default me;
