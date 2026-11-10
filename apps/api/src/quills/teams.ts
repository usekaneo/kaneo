import { and, eq, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { flexibleToTypeIdSchema } from "@kaneo/ids/zod";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
  type BaseVariables,
} from "../openapi";
import platformDb from "../database";
import { teamTable } from "../database/schema";
import { teams, teamMembers } from "../database/quills/schema/teams";
import { withQuillsRequest } from "./with-quills-request";
import { recordQuillsChange } from "./events";
import { workspaceAccess } from "../utils/workspace-access-middleware";
const params = z.object({ workspaceId: z.string().min(1) });
const binding = z.object({
  kaneoTeamId: z.string().min(1).nullable(),
  isDefault: z.boolean().optional(),
});
const responses = {
  200: jsonResponse(
    "Team",
    z.object({
      id: z.string(),
      name: z.string(),
      kaneoTeamId: z.string().nullable(),
      isDefault: z.boolean(),
    }),
  ),
  401: errorResponse("Authentication required"),
  403: errorResponse("Insufficient access"),
  404: errorResponse("Team not found"),
};
const middleware = [workspaceAccess.fromParam("workspaceId")];
async function canonicalTeam(workspaceId: string, id: string) {
  const [team] = await platformDb
    .select()
    .from(teamTable)
    .where(and(eq(teamTable.id, id), eq(teamTable.workspaceId, workspaceId)))
    .limit(1);
  if (!team) throw new HTTPException(404, { message: "Team not found" });
  return team;
}
export default apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(
    createRoute({
      method: "post",
      path: "/{workspaceId}/teams",
      operationId: "bindQuillsTeam",
      tags: ["Quills"],
      summary: "Bind a workspace team to Quills",
      middleware,
      request: {
        params,
        body: {
          content: {
            "application/json": {
              schema: z.object({
                kaneoTeamId: z.string().min(1),
                isDefault: z.boolean().default(false),
              }),
            },
          },
        },
      },
      responses,
    }),
    async (c) => {
      const input = c.req.valid("json");
      const canonical = await canonicalTeam(
        c.get("workspaceId"),
        input.kaneoTeamId,
      );
      const team = await withQuillsRequest(
        c,
        { action: "manage_settings" },
        async (db, actor) => {
          await db.execute(sql`SELECT id FROM quills.settings FOR UPDATE`);
          if (input.isDefault)
            await db
              .update(teams)
              .set({ isDefault: false })
              .where(eq(teams.isDefault, true));
          const [row] = await db
            .insert(teams)
            .values({
              name: canonical.name,
              kaneoTeamId: canonical.id,
              isDefault: input.isDefault,
            })
            .onConflictDoUpdate({
              target: [teams.workspaceId, teams.kaneoTeamId],
              set: { isDefault: input.isDefault, deletedAt: null },
            })
            .returning();
          await recordQuillsChange(db, actor, {
            type: "team.bound",
            entityType: "team",
            entityId: row!.id,
            payload: { kaneoTeamId: canonical.id },
          });
          return row!;
        },
      );
      return c.json(team, 200);
    },
  )
  .openapi(
    createRoute({
      method: "put",
      path: "/{workspaceId}/teams/{teamId}/binding",
      operationId: "updateQuillsTeamBinding",
      tags: ["Quills"],
      summary: "Change the team binding of a Quills team",
      middleware,
      request: {
        params: params.extend({ teamId: flexibleToTypeIdSchema("team") }),
        body: { content: { "application/json": { schema: binding } } },
      },
      responses,
    }),
    async (c) => {
      const input = c.req.valid("json"),
        { teamId } = c.req.valid("param");
      if (input.kaneoTeamId)
        await canonicalTeam(c.get("workspaceId"), input.kaneoTeamId);
      const team = await withQuillsRequest(
        c,
        { action: "manage_settings" },
        async (db, actor) => {
          await db.execute(sql`SELECT id FROM quills.settings FOR UPDATE`);
          if (input.isDefault)
            await db
              .update(teams)
              .set({ isDefault: false })
              .where(eq(teams.isDefault, true));
          const [row] = await db
            .update(teams)
            .set(input)
            .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
            .returning();
          if (!row)
            throw new HTTPException(404, { message: "Quills team not found" });
          await recordQuillsChange(db, actor, {
            type: input.kaneoTeamId ? "team.bound" : "team.unbound",
            entityType: "team",
            entityId: teamId,
            payload: input.kaneoTeamId
              ? { kaneoTeamId: input.kaneoTeamId }
              : {},
          });
          return row;
        },
      );
      return c.json(team, 200);
    },
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/teams",
      operationId: "listQuillsTeams",
      tags: ["Quills"],
      summary: "List Quills teams and their rosters",
      middleware,
      request: { params },
      responses: {
        ...responses,
        200: jsonResponse(
          "Teams and their projected rosters",
          z.object({
            teams: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                kaneoTeamId: z.string().nullable(),
                isDefault: z.boolean(),
              }),
            ),
            members: z.array(
              z.object({ teamId: z.string(), principalId: z.string() }),
            ),
          }),
        ),
      },
    }),
    async (c) =>
      c.json(
        await withQuillsRequest(c, { action: "read" }, async (db) => ({
          teams: await db
            .select({
              id: teams.id,
              name: teams.name,
              kaneoTeamId: teams.kaneoTeamId,
              isDefault: teams.isDefault,
            })
            .from(teams)
            .where(isNull(teams.deletedAt)),
          members: await db
            .select({
              teamId: teamMembers.teamId,
              principalId: teamMembers.principalId,
            })
            .from(teamMembers)
            .innerJoin(teams, eq(teams.id, teamMembers.teamId))
            .where(isNull(teams.deletedAt)),
        })),
        200,
      ),
  );
