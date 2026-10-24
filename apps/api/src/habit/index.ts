import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import getHabits from "./controllers/get-habits";
import {
  createHabit,
  deleteHabit,
  renameHabit,
} from "./controllers/save-habit";
import setHabitCheck from "./controllers/set-habit-check";
import { habitCheckSchema, habitSchema } from "./response";
import {
  habitBody,
  habitCheckParam,
  habitIdParam,
  habitRangeQuery,
} from "./schema";

const getHabitsRoute = createRoute({
  method: "get",
  operationId: "getHabits",
  path: "/",
  tags: ["Habits"],
  summary: "Get habits",
  description:
    "The caller's habits, oldest first, with the days in the range they were done and how many days they were done in total.",
  request: { query: habitRangeQuery },
  responses: {
    200: jsonResponse("Habits", z.array(habitSchema)),
    400: errorResponse("Invalid range"),
  },
});

const createHabitRoute = createRoute({
  method: "post",
  operationId: "createHabit",
  path: "/",
  tags: ["Habits"],
  summary: "Create habit",
  description: "Add a habit to the caller's own list.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: habitBody } },
    },
  },
  responses: {
    200: jsonResponse("The new habit", habitSchema),
    400: errorResponse("Invalid request"),
  },
});

const renameHabitRoute = createRoute({
  method: "put",
  operationId: "renameHabit",
  path: "/{id}",
  tags: ["Habits"],
  summary: "Rename habit",
  description: "Rename one of the caller's habits.",
  request: {
    params: habitIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: habitBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The renamed habit",
      z.object({ id: z.string(), name: z.string() }),
    ),
    404: errorResponse("Habit not found"),
  },
});

const deleteHabitRoute = createRoute({
  method: "delete",
  operationId: "deleteHabit",
  path: "/{id}",
  tags: ["Habits"],
  summary: "Delete habit",
  description: "Delete one of the caller's habits and its history.",
  request: { params: habitIdParam },
  responses: {
    200: jsonResponse("The deleted habit", z.object({ id: z.string() })),
    404: errorResponse("Habit not found"),
  },
});

const checkHabitRoute = createRoute({
  method: "put",
  operationId: "checkHabit",
  path: "/{id}/check/{date}",
  tags: ["Habits"],
  summary: "Mark habit done",
  description: "Mark a habit as done on a day.",
  request: { params: habitCheckParam },
  responses: {
    200: jsonResponse("The habit is done that day", habitCheckSchema),
    404: errorResponse("Habit not found"),
  },
});

const uncheckHabitRoute = createRoute({
  method: "delete",
  operationId: "uncheckHabit",
  path: "/{id}/check/{date}",
  tags: ["Habits"],
  summary: "Clear habit day",
  description: "Mark a habit as not done on a day.",
  request: { params: habitCheckParam },
  responses: {
    200: jsonResponse("The habit is not done that day", habitCheckSchema),
    404: errorResponse("Habit not found"),
  },
});

const habit = apiRouter()
  .openapi(getHabitsRoute, async (c) => {
    const { from, to } = c.req.valid("query");
    return c.json(await getHabits(c.get("userId"), from, to), 200);
  })
  .openapi(createHabitRoute, async (c) =>
    c.json(await createHabit(c.get("userId"), c.req.valid("json").name), 200),
  )
  .openapi(renameHabitRoute, async (c) =>
    c.json(
      await renameHabit(
        c.req.valid("param").id,
        c.get("userId"),
        c.req.valid("json").name,
      ),
      200,
    ),
  )
  .openapi(deleteHabitRoute, async (c) =>
    c.json(await deleteHabit(c.req.valid("param").id, c.get("userId")), 200),
  )
  .openapi(checkHabitRoute, async (c) => {
    const { id, date } = c.req.valid("param");
    return c.json(await setHabitCheck(id, c.get("userId"), date, true), 200);
  })
  .openapi(uncheckHabitRoute, async (c) => {
    const { id, date } = c.req.valid("param");
    return c.json(await setHabitCheck(id, c.get("userId"), date, false), 200);
  });

export default habit;
