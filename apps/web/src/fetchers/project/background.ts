import { client } from "@kaneo/libs";

export async function uploadProjectBackground(projectId: string, file: File) {
  const uploadResponse = await client.project[":id"]["background-upload"].$put({
    param: { id: projectId },
    json: { contentType: file.type, size: file.size },
  });

  if (!uploadResponse.ok) throw new Error(await uploadResponse.text());
  const upload = await uploadResponse.json();

  const storageResponse = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: file,
  });
  if (!storageResponse.ok)
    throw new Error();

  const finalizeResponse = await client.project[":id"][
    "background-upload"
  ].finalize.$post({
    param: { id: projectId },
    json: {
      key: upload.key,
      contentType: file.type,
      size: file.size,
      version: upload.version,
    },
  });
  if (!finalizeResponse.ok) throw new Error(await finalizeResponse.text());

  return finalizeResponse.json();
}

export async function removeProjectBackground(projectId: string) {
  const response = await client.project[":id"].background.$delete({
    param: { id: projectId },
  });
  if (!response.ok) throw new Error(await response.text());
}
