import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

export type Salary = InferResponseType<
  (typeof client)["pay"]["salaries"]["$get"],
  200
>[number];
export type CurrentSalary = InferResponseType<
  (typeof client)["pay"]["salaries"]["current"]["$get"],
  200
>[number];
export type PayrollRunSummary = InferResponseType<
  (typeof client)["pay"]["runs"]["$get"],
  200
>[number];
export type PayrollRun = InferResponseType<
  (typeof client)["pay"]["runs"][":id"]["$get"],
  200
>;
export type Payslip = InferResponseType<
  (typeof client)["pay"]["payslips"]["$get"],
  200
>[number];
export type AddSalaryRequest = InferRequestType<
  (typeof client)["pay"]["salaries"]["$post"]
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

export const payApi = {
  salaries: async (workspaceId: string, userId?: string) =>
    unwrap(
      await client.pay.salaries.$get({
        query: { workspaceId, ...(userId ? { userId } : {}) },
      }),
    ),
  currentSalaries: async (workspaceId: string) =>
    unwrap(await client.pay.salaries.current.$get({ query: { workspaceId } })),
  addSalary: async (json: AddSalaryRequest) =>
    unwrap(await client.pay.salaries.$post({ json })),
  runs: async (workspaceId: string) =>
    unwrap(await client.pay.runs.$get({ query: { workspaceId } })),
  run: async (workspaceId: string, id: string) =>
    unwrap(
      await client.pay.runs[":id"].$get({
        param: { id },
        query: { workspaceId },
      }),
    ),
  createRun: async (workspaceId: string, year: number, month: number) =>
    unwrap(await client.pay.runs.$post({ json: { workspaceId, year, month } })),
  recalculate: async (workspaceId: string, id: string) =>
    unwrap(
      await client.pay.runs[":id"].recalculate.$post({
        param: { id },
        json: { workspaceId },
      }),
    ),
  updateItem: async (
    workspaceId: string,
    id: string,
    itemId: string,
    input: { bonus: number; deduction: number; note?: string | null },
  ) =>
    unwrap(
      await client.pay.runs[":id"].items[":itemId"].$put({
        param: { id, itemId },
        json: { workspaceId, ...input },
      }),
    ),
  approve: async (workspaceId: string, id: string) =>
    unwrap(
      await client.pay.runs[":id"].approve.$post({
        param: { id },
        json: { workspaceId },
      }),
    ),
  markPaid: async (workspaceId: string, id: string) =>
    unwrap(
      await client.pay.runs[":id"].paid.$post({
        param: { id },
        json: { workspaceId },
      }),
    ),
  deleteRun: async (workspaceId: string, id: string) =>
    unwrap(
      await client.pay.runs[":id"].$delete({
        param: { id },
        query: { workspaceId },
      }),
    ),
  payslips: async (workspaceId: string, userId?: string) =>
    unwrap(
      await client.pay.payslips.$get({
        query: { workspaceId, ...(userId ? { userId } : {}) },
      }),
    ),
};
