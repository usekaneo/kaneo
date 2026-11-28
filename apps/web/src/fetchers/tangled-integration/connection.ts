import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type TangledConnectionInput = {
  baseUrl: string;
  repositoryDid: string;
  repositoryId: string;
  repositoryUrl: string;
  branchPattern: string;
  webhookSecret: string;
  isActive: boolean;
};

export async function getTangledConnection(projectId: string) {
  const response = await client["tangled-integration"].project[
    ":projectId"
  ].$get({ param: { projectId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function saveTangledConnection(
  projectId: string,
  data: TangledConnectionInput | Partial<TangledConnectionInput>,
  connected: boolean,
) {
  const endpoint = client["tangled-integration"].project[":projectId"];
  const response = connected
    ? await endpoint.$patch({ param: { projectId }, json: data })
    : await endpoint.$post({
        param: { projectId },
        json: data as TangledConnectionInput,
      });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteTangledConnection(projectId: string) {
  const response = await client["tangled-integration"].project[
    ":projectId"
  ].$delete({ param: { projectId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getTangledOutcome(projectId: string) {
  const response = await client["tangled-integration"].project[
    ":projectId"
  ].outcome.$get({ param: { projectId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
