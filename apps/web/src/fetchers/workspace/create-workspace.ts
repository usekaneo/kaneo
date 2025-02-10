import { api } from '@kaneo/libs';

const createWorkspace = async ({ name }: { name: string }) => {
  const response = await api.workspace.create.post({ name });

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response.data;
};

export default createWorkspace;
