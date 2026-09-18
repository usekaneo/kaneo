import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

export type LeaveRequest = InferResponseType<
  (typeof client)["requests"]["leave"]["$get"],
  200
>[number];
export type LeaveBalance = InferResponseType<
  (typeof client)["requests"]["leave"]["balance"]["$get"],
  200
>;
export type LeaveHistoryItem = InferResponseType<
  (typeof client)["requests"]["leave"]["all"]["$get"],
  200
>[number];
export type LeaveHistoryFilters = Omit<
  InferRequestType<
    (typeof client)["requests"]["leave"]["all"]["$get"]
  >["query"],
  "workspaceId"
>;
export type Expense = InferResponseType<
  (typeof client)["requests"]["expenses"]["$get"],
  200
>[number];
export type LeaveRequestBody = InferRequestType<
  (typeof client)["requests"]["leave"]["$post"]
>["json"];
export type ExpenseBody = InferRequestType<
  (typeof client)["requests"]["expenses"]["$post"]
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

const person = (workspaceId: string, userId?: string) => ({
  workspaceId,
  ...(userId ? { userId } : {}),
});

export const requestsApi = {
  leave: async (workspaceId: string, userId?: string) =>
    unwrap(
      await client.requests.leave.$get({ query: person(workspaceId, userId) }),
    ),
  balance: async (workspaceId: string, userId?: string) =>
    unwrap(
      await client.requests.leave.balance.$get({
        query: person(workspaceId, userId),
      }),
    ),
  requestLeave: async (json: LeaveRequestBody) =>
    unwrap(await client.requests.leave.$post({ json })),
  cancelLeave: async (workspaceId: string, id: string) =>
    unwrap(
      await client.requests.leave[":id"].cancel.$post({
        param: { id },
        json: { workspaceId },
      }),
    ),
  decideLeave: async (
    workspaceId: string,
    id: string,
    decision: "approved" | "rejected",
    note?: string,
  ) =>
    unwrap(
      await client.requests.leave[":id"].decide.$post({
        param: { id },
        json: { workspaceId, decision, ...(note ? { note } : {}) },
      }),
    ),
  allLeave: async (workspaceId: string, filters: LeaveHistoryFilters) =>
    unwrap(
      await client.requests.leave.all.$get({
        query: { workspaceId, ...filters },
      }),
    ),
  previewLeave: async (
    workspaceId: string,
    startDate: string,
    endDate: string,
  ) =>
    unwrap(
      await client.requests.leave.preview.$get({
        query: { workspaceId, startDate, endDate },
      }),
    ),
  expenses: async (workspaceId: string, userId?: string) =>
    unwrap(
      await client.requests.expenses.$get({
        query: person(workspaceId, userId),
      }),
    ),
  submitExpense: async (json: ExpenseBody) =>
    unwrap(await client.requests.expenses.$post({ json })),
  cancelExpense: async (workspaceId: string, id: string) =>
    unwrap(
      await client.requests.expenses[":id"].cancel.$post({
        param: { id },
        json: { workspaceId },
      }),
    ),
  decideExpense: async (
    workspaceId: string,
    id: string,
    decision: "approved" | "rejected",
  ) =>
    unwrap(
      await client.requests.expenses[":id"].decide.$post({
        param: { id },
        json: { workspaceId, decision },
      }),
    ),
  markExpensePaid: async (workspaceId: string, id: string) =>
    unwrap(
      await client.requests.expenses[":id"].paid.$post({
        param: { id },
        json: { workspaceId },
      }),
    ),
  open: async (workspaceId: string) =>
    unwrap(await client.requests.open.$get({ query: { workspaceId } })),
  uploadReceipt: async (workspaceId: string, file: File) => {
    const buffer = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buffer.length; i += 0x8000) {
      binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
    }
    return unwrap(
      await client.requests.receipts.$post({
        json: { workspaceId, filename: file.name, data: btoa(binary) },
      }),
    );
  },
};

export function receiptUrl(workspaceId: string, fileId: string) {
  return client.requests.receipts[":id"]
    .$url({ param: { id: fileId }, query: { workspaceId } })
    .toString();
}
