import { HTTPException } from "hono/http-exception";
import { getCompanySettings } from "../company/settings";
import { zonedDay } from "../company/zoned-time";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import {
  FILE_SECURITY_HEADERS,
  openBlob,
  safeDisposition,
  servedType,
} from "../storage/workspace-storage";
import { assertSelfOrPermission } from "../utils/assert-self-or-permission";
import { limitBody } from "../utils/limit-body";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  cancelExpense,
  cancelLeave,
  decideExpense,
  decideLeave,
  leaveBalance,
  listAllLeave,
  listExpenses,
  listLeave,
  markExpensePaid,
  openRequests,
  requestLeave,
  submitExpense,
  workingDays,
} from "./controllers";
import "./notify";
import { readReceipt, receiptOwner, storeReceipt } from "./files";
import {
  deletedSchema,
  expenseListSchema,
  expenseSchema,
  leaveBalanceSchema,
  leaveBasicSchema,
  leaveHistorySchema,
  leavePreviewSchema,
  leaveRequestListSchema,
  openRequestsSchema,
  storedFileSchema,
} from "./response";
import {
  allLeaveQuery,
  balanceQuery,
  decideBody,
  expenseBody,
  idParam,
  leaveBody,
  personQuery,
  previewQuery,
  receiptBody,
  workspaceBody,
  workspaceQuery,
} from "./schema";

const tags = ["Requests"];
const json = <T>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});
const approver = requireWorkspacePermission({ request: ["approve"] });

const listLeaveRoute = createRoute({
  method: "get",
  operationId: "listLeaveRequests",
  path: "/leave",
  tags,
  summary: "Leave requests",
  description:
    "A person's leave requests. Yours, or anyone's with request:approve.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: personQuery },
  responses: {
    200: jsonResponse("Leave requests", leaveRequestListSchema),
    403: errorResponse("Not you, and missing request:approve"),
  },
});

const allLeaveRoute = createRoute({
  method: "get",
  operationId: "listAllLeave",
  path: "/leave/all",
  tags,
  summary: "Everyone's leave",
  description:
    "Leave history across the workspace, with who decided it. Filter by status, person, or dates. Needs request:approve.",
  middleware: [workspaceAccess.fromQuery(), approver] as const,
  request: { query: allLeaveQuery },
  responses: {
    200: jsonResponse("Leave requests", leaveHistorySchema),
    403: errorResponse("Missing request:approve"),
  },
});

const previewLeaveRoute = createRoute({
  method: "get",
  operationId: "previewLeave",
  path: "/leave/preview",
  tags,
  summary: "Count leave days",
  description:
    "How many working days a leave request for these dates would take, on your own schedule.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: previewQuery },
  responses: {
    200: jsonResponse("Working days", leavePreviewSchema),
  },
});

const balanceRoute = createRoute({
  method: "get",
  operationId: "getLeaveBalance",
  path: "/leave/balance",
  tags,
  summary: "Leave balance",
  description:
    "Allowance, used, pending and available days for a year (annual and sick leave).",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: balanceQuery },
  responses: {
    200: jsonResponse("Balance", leaveBalanceSchema),
    403: errorResponse("Not you, and missing request:approve"),
  },
});

const requestLeaveRoute = createRoute({
  method: "post",
  operationId: "requestLeave",
  path: "/leave",
  tags,
  summary: "Request leave",
  description: "Ask for days off. Working days are counted from your schedule.",
  middleware: [workspaceAccess.fromBody()] as const,
  request: { body: json(leaveBody) },
  responses: {
    200: jsonResponse("The request", leaveBasicSchema),
    400: errorResponse("No working days in that range"),
    409: errorResponse("Overlaps existing leave"),
  },
});

const cancelLeaveRoute = createRoute({
  method: "post",
  operationId: "cancelLeave",
  path: "/leave/{id}/cancel",
  tags,
  summary: "Cancel a leave request",
  description:
    "Withdraw your own pending request. With request:approve, also call off approved leave that hasn't ended (audit logged).",
  middleware: [workspaceAccess.fromBody()] as const,
  request: { params: idParam, body: json(workspaceBody) },
  responses: {
    200: jsonResponse("The request", leaveBasicSchema),
    409: errorResponse("Not pending"),
  },
});

const decideLeaveRoute = createRoute({
  method: "post",
  operationId: "decideLeave",
  path: "/leave/{id}/decide",
  tags,
  summary: "Approve or reject leave",
  description: "Decide someone else's pending leave request. Audit logged.",
  middleware: [workspaceAccess.fromBody(), approver] as const,
  request: { params: idParam, body: json(decideBody) },
  responses: {
    200: jsonResponse("The request", leaveBasicSchema),
    403: errorResponse("Missing request:approve, or your own request"),
    409: errorResponse("Already decided"),
  },
});

const listExpensesRoute = createRoute({
  method: "get",
  operationId: "listExpenses",
  path: "/expenses",
  tags,
  summary: "Expenses",
  description: "A person's expenses. Yours, or anyone's with request:approve.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: personQuery },
  responses: {
    200: jsonResponse("Expenses", expenseListSchema),
    403: errorResponse("Not you, and missing request:approve"),
  },
});

const submitExpenseRoute = createRoute({
  method: "post",
  operationId: "submitExpense",
  path: "/expenses",
  tags,
  summary: "Submit an expense",
  description:
    "Claim money you spent, in the workspace currency, optionally for a project with a receipt.",
  middleware: [workspaceAccess.fromBody()] as const,
  request: { body: json(expenseBody) },
  responses: {
    200: jsonResponse("The expense", expenseSchema),
    400: errorResponse("Unknown project or receipt"),
  },
});

const cancelExpenseRoute = createRoute({
  method: "post",
  operationId: "cancelExpense",
  path: "/expenses/{id}/cancel",
  tags,
  summary: "Cancel an expense",
  description: "Withdraw your own pending expense.",
  middleware: [workspaceAccess.fromBody()] as const,
  request: { params: idParam, body: json(workspaceBody) },
  responses: {
    200: jsonResponse("Removed", deletedSchema),
    409: errorResponse("Not pending"),
  },
});

const decideExpenseRoute = createRoute({
  method: "post",
  operationId: "decideExpense",
  path: "/expenses/{id}/decide",
  tags,
  summary: "Approve or reject an expense",
  description: "Decide someone else's pending expense. Audit logged.",
  middleware: [workspaceAccess.fromBody(), approver] as const,
  request: { params: idParam, body: json(decideBody) },
  responses: {
    200: jsonResponse("The expense", expenseSchema),
    403: errorResponse("Missing request:approve, or your own expense"),
    409: errorResponse("Already decided"),
  },
});

const paidExpenseRoute = createRoute({
  method: "post",
  operationId: "markExpensePaid",
  path: "/expenses/{id}/paid",
  tags,
  summary: "Mark an expense paid",
  description: "Record that an approved expense was paid back. Audit logged.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ payroll: ["manage"] }),
  ] as const,
  request: { params: idParam, body: json(workspaceBody) },
  responses: {
    200: jsonResponse("The expense", expenseSchema),
    403: errorResponse("Missing payroll:manage"),
    409: errorResponse("Not approved"),
  },
});

const openRoute = createRoute({
  method: "get",
  operationId: "getOpenRequests",
  path: "/open",
  tags,
  summary: "Requests waiting",
  description:
    "Pending leave, and expenses that are pending or approved but not paid.",
  middleware: [workspaceAccess.fromQuery(), approver] as const,
  request: { query: workspaceQuery },
  responses: {
    200: jsonResponse("Open requests", openRequestsSchema),
    403: errorResponse("Missing request:approve"),
  },
});

const uploadReceiptRoute = createRoute({
  method: "post",
  operationId: "uploadReceipt",
  path: "/receipts",
  tags,
  summary: "Upload a receipt",
  description: "A PNG, JPEG, GIF, WebP or PDF of at most 5 MB, as base64.",
  middleware: [limitBody(7_200_000), workspaceAccess.fromBody()] as const,
  request: { body: json(receiptBody) },
  responses: {
    200: jsonResponse("The stored file", storedFileSchema),
    400: errorResponse("Not an image or PDF"),
    413: errorResponse("Larger than 5 MB"),
  },
});

const downloadReceiptRoute = createRoute({
  method: "get",
  operationId: "downloadReceipt",
  path: "/receipts/{id}",
  tags,
  summary: "Download a receipt",
  description:
    "The receipt file. For the person who uploaded it, approvers and payroll.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { params: idParam, query: workspaceQuery },
  responses: {
    200: {
      description: "The file",
      content: {
        "application/octet-stream": {
          schema: z.string().openapi({ format: "binary" }),
        },
      },
    },
    403: errorResponse("Not allowed to see this receipt"),
    404: errorResponse("Not found"),
  },
});

const requests = apiRouter()
  .openapi(listLeaveRoute, async (c) => {
    const { workspaceId, userId } = c.req.valid("query");
    const target = userId ?? c.get("userId");
    await assertSelfOrPermission(c, target, { request: ["approve"] });
    return c.json(await listLeave(workspaceId, target), 200);
  })
  .openapi(balanceRoute, async (c) => {
    const { workspaceId, userId, year } = c.req.valid("query");
    const target = userId ?? c.get("userId");
    await assertSelfOrPermission(c, target, { request: ["approve"] });
    const company = await getCompanySettings(workspaceId);
    const thisYear = Number(zonedDay(new Date(), company.timezone).slice(0, 4));
    return c.json(
      await leaveBalance(workspaceId, target, year ?? thisYear),
      200,
    );
  })
  .openapi(allLeaveRoute, async (c) => {
    const { workspaceId, ...filters } = c.req.valid("query");
    return c.json(await listAllLeave(workspaceId, filters), 200);
  })
  .openapi(previewLeaveRoute, async (c) => {
    const { workspaceId, startDate, endDate } = c.req.valid("query");
    return c.json(
      {
        days: await workingDays(
          workspaceId,
          c.get("userId"),
          startDate,
          endDate,
        ),
      },
      200,
    );
  })
  .openapi(requestLeaveRoute, async (c) => {
    const { workspaceId, ...input } = c.req.valid("json");
    return c.json(await requestLeave(workspaceId, c.get("userId"), input), 200);
  })
  .openapi(cancelLeaveRoute, async (c) => {
    const { workspaceId } = c.req.valid("json");
    const company = await getCompanySettings(workspaceId);
    return c.json(
      await cancelLeave(
        workspaceId,
        c.get("userId"),
        c.req.valid("param").id,
        await hasWorkspacePermission(c, { request: ["approve"] }),
        zonedDay(new Date(), company.timezone),
      ),
      200,
    );
  })
  .openapi(decideLeaveRoute, async (c) => {
    const { workspaceId, decision, note } = c.req.valid("json");
    return c.json(
      await decideLeave(
        workspaceId,
        c.get("userId"),
        c.req.valid("param").id,
        decision,
        note,
      ),
      200,
    );
  })
  .openapi(listExpensesRoute, async (c) => {
    const { workspaceId, userId } = c.req.valid("query");
    const target = userId ?? c.get("userId");
    await assertSelfOrPermission(c, target, { request: ["approve"] });
    return c.json(await listExpenses(workspaceId, target), 200);
  })
  .openapi(submitExpenseRoute, async (c) => {
    const { workspaceId, ...input } = c.req.valid("json");
    const expense = await submitExpense(workspaceId, c.get("userId"), input);
    if (!expense) throw new HTTPException(500, { message: "Failed to save" });
    return c.json(expense, 200);
  })
  .openapi(cancelExpenseRoute, async (c) =>
    c.json(
      await cancelExpense(
        c.req.valid("json").workspaceId,
        c.get("userId"),
        c.req.valid("param").id,
      ),
      200,
    ),
  )
  .openapi(decideExpenseRoute, async (c) => {
    const { workspaceId, decision } = c.req.valid("json");
    return c.json(
      await decideExpense(
        workspaceId,
        c.get("userId"),
        c.req.valid("param").id,
        decision,
      ),
      200,
    );
  })
  .openapi(paidExpenseRoute, async (c) =>
    c.json(
      await markExpensePaid(
        c.req.valid("json").workspaceId,
        c.get("userId"),
        c.req.valid("param").id,
      ),
      200,
    ),
  )
  .openapi(openRoute, async (c) =>
    c.json(await openRequests(c.req.valid("query").workspaceId), 200),
  )
  .openapi(uploadReceiptRoute, async (c) => {
    const { workspaceId, filename, data } = c.req.valid("json");
    return c.json(
      await storeReceipt(workspaceId, c.get("userId"), filename, data),
      200,
    );
  })
  .openapi(downloadReceiptRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { workspaceId } = c.req.valid("query");
    const file = await readReceipt(workspaceId, id);
    const self = c.get("userId");
    const owner = await receiptOwner(id);
    const allowed =
      file.uploadedBy === self ||
      owner === self ||
      (await hasWorkspacePermission(c, { request: ["approve"] })) ||
      (await hasWorkspacePermission(c, { payroll: ["manage"] }));
    if (!allowed) {
      throw new HTTPException(403, {
        message: "You can't see this receipt",
      });
    }
    const opened = await openBlob(file);
    if ("redirect" in opened) return c.redirect(opened.redirect, 302);
    return c.body(new Uint8Array(opened.bytes), 200, {
      "Content-Type": servedType(file.mimeType),
      "Content-Length": String(file.size),
      "Content-Disposition": safeDisposition(file.mimeType, file.filename),
      ...FILE_SECURITY_HEADERS,
      "Cache-Control": "private, max-age=300",
    });
  });

export default requests;
