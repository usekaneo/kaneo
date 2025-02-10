import { api } from '@kaneo/libs';

const signOut = async () => {
  const response = await api.user['sign-out'].post();

  return response;
};

export default signOut;
