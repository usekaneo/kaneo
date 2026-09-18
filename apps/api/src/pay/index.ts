import { getCompanySettings } from "../company/settings";
import { zonedDay } from "../company/zoned-time";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { assertSelfOrPermission } from "../utils/assert-self-or-permission";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  addSalary,
  changeRunStatus,
  createRun,
  currentSalaries,
  deleteRun,
  getRun,
  listRuns,
  payslips,
  recalculateRun,
  salaryHistory,
  updateItem,
} from "./controllers";
import {
  currentSalaryListSchema,
  payrollRunBasicSchema,
  payrollRunListSchema,
  payrollRunSchema,
  payslipListSchema,
  salaryListSchema,
  salarySchema,
} from "./response";
import {
  addSalaryBody,
  createRunBody,
  itemParam,
  personQuery,
  runParam,
  updateItemBody,
  workspaceBody,
  workspaceQuery,
} from "./schema";

const tags = ["Pay"];
const json = <T>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});
const canRead = requireWorkspacePermission({ payroll: ["read"] });
const canManage = requireWorkspacePermission({ payroll: ["manage"] });
const forbidden = errorResponse("Missing payroll permission");

const salaryHistoryRoute = createRoute({
  method: "get",
  operationId: "getSalaryHistory",
  path: "/salaries",
  tags,
  summary: "Salary history",
  description:
    "Every salary record for a person, newest first. Your own, or anyone's with payroll:read.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: personQuery },
  responses: {
    200: jsonResponse("Salary history", salaryListSchema),
    403: forbidden,
  },
});

const currentSalariesRoute = createRoute({
  method: "get",
  operationId: "getCurrentSalaries",
  path: "/salaries/current",
  tags,
  summary: "Current salaries",
  description: "Everyone's salary in force today.",
  middleware: [workspaceAccess.fromQuery(), canRead] as const,
  request: { query: workspaceQuery },
  responses: {
    200: jsonResponse("Current salaries", currentSalaryListSchema),
    403: forbidden,
  },
});

const addSalaryRoute = createRoute({
  method: "post",
  operationId: "addSalary",
  path: "/salaries",
  tags,
  summary: "Add a salary record",
  description:
    "Record a salary from an effective date. Earlier records are kept. Audit logged.",
  middleware: [workspaceAccess.fromBody(), canManage] as const,
  request: { body: json(addSalaryBody) },
  responses: {
    200: jsonResponse("The new record", salarySchema),
    403: forbidden,
    404: errorResponse("Person not found"),
  },
});

const listRunsRoute = createRoute({
  method: "get",
  operationId: "listPayrollRuns",
  path: "/runs",
  tags,
  summary: "List payrolls",
  description: "Monthly payrolls with their status and total.",
  middleware: [workspaceAccess.fromQuery(), canRead] as const,
  request: { query: workspaceQuery },
  responses: {
    200: jsonResponse("Payrolls", payrollRunListSchema),
    403: forbidden,
  },
});

const createRunRoute = createRoute({
  method: "post",
  operationId: "createPayrollRun",
  path: "/runs",
  tags,
  summary: "Create a payroll",
  description:
    "Draft a month's payroll from salaries and attendance (overtime). Audit logged.",
  middleware: [workspaceAccess.fromBody(), canManage] as const,
  request: { body: json(createRunBody) },
  responses: {
    200: jsonResponse("The draft", payrollRunSchema),
    403: forbidden,
    409: errorResponse("That month already has a payroll"),
  },
});

const getRunRoute = createRoute({
  method: "get",
  operationId: "getPayrollRun",
  path: "/runs/{id}",
  tags,
  summary: "Get a payroll",
  description: "A payroll with one line per person.",
  middleware: [workspaceAccess.fromQuery(), canRead] as const,
  request: { params: runParam, query: workspaceQuery },
  responses: {
    200: jsonResponse("The payroll", payrollRunSchema),
    403: forbidden,
    404: errorResponse("Not found"),
  },
});

const recalculateRoute = createRoute({
  method: "post",
  operationId: "recalculatePayrollRun",
  path: "/runs/{id}/recalculate",
  tags,
  summary: "Recalculate a draft",
  description:
    "Rebuild a draft from current salaries and attendance. Bonuses, deductions and notes are kept.",
  middleware: [workspaceAccess.fromBody(), canManage] as const,
  request: { params: runParam, body: json(workspaceBody) },
  responses: {
    200: jsonResponse("The payroll", payrollRunSchema),
    403: forbidden,
    409: errorResponse("Not a draft"),
  },
});

const updateItemRoute = createRoute({
  method: "put",
  operationId: "updatePayrollItem",
  path: "/runs/{id}/items/{itemId}",
  tags,
  summary: "Adjust a payroll line",
  description: "Set bonus, deduction and note on a draft line. Audit logged.",
  middleware: [workspaceAccess.fromBody(), canManage] as const,
  request: { params: itemParam, body: json(updateItemBody) },
  responses: {
    200: jsonResponse("The payroll", payrollRunSchema),
    403: forbidden,
    409: errorResponse("Not a draft"),
  },
});

const approveRoute = createRoute({
  method: "post",
  operationId: "approvePayrollRun",
  path: "/runs/{id}/approve",
  tags,
  summary: "Approve a payroll",
  description: "Lock a draft. People can then see their payslip.",
  middleware: [workspaceAccess.fromBody(), canManage] as const,
  request: { params: runParam, body: json(workspaceBody) },
  responses: {
    200: jsonResponse("The payroll", payrollRunSchema),
    403: forbidden,
    409: errorResponse("Not a draft"),
  },
});

const paidRoute = createRoute({
  method: "post",
  operationId: "markPayrollRunPaid",
  path: "/runs/{id}/paid",
  tags,
  summary: "Mark a payroll paid",
  description: "Record that an approved payroll has been paid.",
  middleware: [workspaceAccess.fromBody(), canManage] as const,
  request: { params: runParam, body: json(workspaceBody) },
  responses: {
    200: jsonResponse("The payroll", payrollRunSchema),
    403: forbidden,
    409: errorResponse("Not approved"),
  },
});

const deleteRunRoute = createRoute({
  method: "delete",
  operationId: "deletePayrollRun",
  path: "/runs/{id}",
  tags,
  summary: "Delete a draft payroll",
  description: "Only drafts can be deleted. Audit logged.",
  middleware: [workspaceAccess.fromQuery(), canManage] as const,
  request: { params: runParam, query: workspaceQuery },
  responses: {
    200: jsonResponse("The deleted payroll", payrollRunBasicSchema),
    403: forbidden,
    409: errorResponse("Not a draft"),
  },
});

const payslipsRoute = createRoute({
  method: "get",
  operationId: "getPayslips",
  path: "/payslips",
  tags,
  summary: "Payslips",
  description:
    "Approved and paid months for a person. Your own, or anyone's with payroll:read.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: personQuery },
  responses: {
    200: jsonResponse("Payslips", payslipListSchema),
    403: forbidden,
  },
});

const pay = apiRouter()
  .openapi(salaryHistoryRoute, async (c) => {
    const { workspaceId, userId } = c.req.valid("query");
    const target = userId ?? c.get("userId");
    await assertSelfOrPermission(c, target, { payroll: ["read"] });
    return c.json(await salaryHistory(workspaceId, target), 200);
  })
  .openapi(currentSalariesRoute, async (c) => {
    const { workspaceId } = c.req.valid("query");
    const company = await getCompanySettings(workspaceId);
    return c.json(
      await currentSalaries(
        workspaceId,
        zonedDay(new Date(), company.timezone),
      ),
      200,
    );
  })
  .openapi(addSalaryRoute, async (c) => {
    const { workspaceId, ...input } = c.req.valid("json");
    const created = await addSalary(workspaceId, c.get("userId"), input);
    const [row] = (await salaryHistory(workspaceId, input.userId)).filter(
      (s) => s.id === created.id,
    );
    return c.json(row ?? { ...created, createdByName: null }, 200);
  })
  .openapi(listRunsRoute, async (c) =>
    c.json(await listRuns(c.req.valid("query").workspaceId), 200),
  )
  .openapi(createRunRoute, async (c) => {
    const { workspaceId, year, month } = c.req.valid("json");
    return c.json(
      await createRun(workspaceId, c.get("userId"), year, month),
      200,
    );
  })
  .openapi(getRunRoute, async (c) =>
    c.json(
      await getRun(c.req.valid("query").workspaceId, c.req.valid("param").id),
      200,
    ),
  )
  .openapi(recalculateRoute, async (c) =>
    c.json(
      await recalculateRun(
        c.req.valid("json").workspaceId,
        c.get("userId"),
        c.req.valid("param").id,
      ),
      200,
    ),
  )
  .openapi(updateItemRoute, async (c) => {
    const { id, itemId } = c.req.valid("param");
    const { workspaceId, ...input } = c.req.valid("json");
    return c.json(
      await updateItem(workspaceId, c.get("userId"), id, itemId, input),
      200,
    );
  })
  .openapi(approveRoute, async (c) =>
    c.json(
      await changeRunStatus(
        c.req.valid("json").workspaceId,
        c.get("userId"),
        c.req.valid("param").id,
        "approved",
      ),
      200,
    ),
  )
  .openapi(paidRoute, async (c) =>
    c.json(
      await changeRunStatus(
        c.req.valid("json").workspaceId,
        c.get("userId"),
        c.req.valid("param").id,
        "paid",
      ),
      200,
    ),
  )
  .openapi(deleteRunRoute, async (c) =>
    c.json(
      await deleteRun(
        c.req.valid("query").workspaceId,
        c.get("userId"),
        c.req.valid("param").id,
      ),
      200,
    ),
  )
  .openapi(payslipsRoute, async (c) => {
    const { workspaceId, userId } = c.req.valid("query");
    const target = userId ?? c.get("userId");
    await assertSelfOrPermission(c, target, { payroll: ["read"] });
    return c.json(await payslips(workspaceId, target), 200);
  });

export default pay;
