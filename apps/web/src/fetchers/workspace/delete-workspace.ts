import { api } from '@kaneo/libs';

const deleteWorkspace = async ({ id }: { id: string }) => {
  const response = await api.workspace({ id }).delete();

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response;
};

export default deleteWorkspace;
