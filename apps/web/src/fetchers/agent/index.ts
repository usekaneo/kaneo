import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type AgentDevice = InferResponseType<
  (typeof client)["agent"]["devices"]["$get"],
  200
>[number];
export type ActivitySummary = InferResponseType<
  (typeof client)["agent"]["activity"]["summary"]["$get"],
  200
>;
export type ActivitySpan = InferResponseType<
  (typeof client)["agent"]["activity"]["spans"]["$get"],
  200
>[number];

async function unwrap<T>(response: {
  ok: boolean;
  text: () => Promise<string>;
  json: () => Promise<T>;
}) {
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function createPairingCode(workspaceId: string) {
  return unwrap(
    await client.agent["pairing-code"].$post({ json: { workspaceId } }),
  );
}

export async function listDevices(workspaceId: string, userId?: string) {
  return unwrap(
    await client.agent.devices.$get({
      query: { workspaceId, ...(userId ? { userId } : {}) },
    }),
  );
}

export async function revokeDevice(workspaceId: string, id: string) {
  return unwrap(
    await client.agent.devices[":id"].$delete({
      param: { id },
      query: { workspaceId },
    }),
  );
}

export async function getActivitySummary(query: {
  workspaceId: string;
  userId?: string;
  from: string;
  to: string;
}) {
  return unwrap(await client.agent.activity.summary.$get({ query }));
}

export async function getActivitySpans(query: {
  workspaceId: string;
  userId?: string;
  day: string;
}) {
  return unwrap(await client.agent.activity.spans.$get({ query }));
}
