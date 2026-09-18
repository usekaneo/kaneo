import { client, windowId } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

export type WorkspaceFile = InferResponseType<
  (typeof client)["files"]["$get"],
  200
>["files"][number];
export type WorkspaceFolder = InferResponseType<
  (typeof client)["files"]["$get"],
  200
>["folders"][number];
export type FileStorage = InferResponseType<
  (typeof client)["files"]["storage"]["$get"],
  200
>;
export type ConnectStorageRequest = InferRequestType<
  (typeof client)["files"]["storage"]["$put"]
>["json"];

async function unwrap<T>(response: {
  ok: boolean;
  text: () => Promise<string>;
  json: () => Promise<T>;
}) {
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      message = JSON.parse(text).message ?? text;
    } catch {}
    throw new Error(message);
  }
  return response.json();
}

export const filesApi = {
  list: async (workspaceId: string, folder: string) =>
    unwrap(await client.files.$get({ query: { workspaceId, folder } })),
  storage: async (workspaceId: string) =>
    unwrap(await client.files.storage.$get({ query: { workspaceId } })),
  connect: async (json: ConnectStorageRequest) =>
    unwrap(await client.files.storage.$put({ json })),
  disconnect: async (workspaceId: string) =>
    unwrap(await client.files.storage.$delete({ query: { workspaceId } })),
  share: async (workspaceId: string, id: string) =>
    unwrap(
      await client.files[":id"].share.$post({
        param: { id },
        json: { workspaceId },
      }),
    ),
  unshare: async (workspaceId: string, id: string) =>
    unwrap(
      await client.files[":id"].share.$delete({
        param: { id },
        query: { workspaceId },
      }),
    ),
  remove: async (workspaceId: string, id: string) =>
    unwrap(
      await client.files[":id"].$delete({
        param: { id },
        query: { workspaceId },
      }),
    ),
  update: async (
    workspaceId: string,
    id: string,
    changes: { filename?: string; folder?: string },
  ) =>
    unwrap(
      await client.files[":id"].$patch({
        param: { id },
        json: { workspaceId, ...changes },
      }),
    ),
  allFolders: async (workspaceId: string) =>
    unwrap(await client.files.folders.$get({ query: { workspaceId } })),
  createFolder: async (workspaceId: string, parent: string, name: string) =>
    unwrap(
      await client.files.folders.$post({
        json: { workspaceId, parent, name },
      }),
    ),
  moveFolder: async (workspaceId: string, from: string, to: string) =>
    unwrap(
      await client.files.folders.$patch({ json: { workspaceId, from, to } }),
    ),
  deleteFolder: async (workspaceId: string, path: string) =>
    unwrap(
      await client.files.folders.$delete({ query: { workspaceId, path } }),
    ),
  downloadUrl: (workspaceId: string, id: string) =>
    client.files[":id"].download
      .$url({ param: { id }, query: { workspaceId } })
      .toString(),
  // The typed client sends JSON; an upload is the raw file, so it goes
  // through XHR (fetch can't report upload progress) with the client's URL
  // and the same credentials.
  upload: (
    workspaceId: string,
    file: File,
    folder: string,
    onProgress?: (fraction: number) => void,
  ) => {
    const url = client.files.upload.$url({
      query: { workspaceId, name: file.name, folder },
    });
    return new Promise<WorkspaceFile>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url.toString());
      xhr.withCredentials = true;
      xhr.setRequestHeader(
        "Content-Type",
        file.type || "application/octet-stream",
      );
      xhr.setRequestHeader("X-Kaneo-Window-Id", windowId);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.onload = () =>
        unwrap<WorkspaceFile>({
          ok: xhr.status >= 200 && xhr.status < 300,
          text: async () => xhr.responseText,
          json: async () => JSON.parse(xhr.responseText),
        }).then(resolve, reject);
      xhr.send(file);
    });
  },
};
