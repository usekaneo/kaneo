import getSettings from "@/utils/get-settings";
import { publicProcedure, router } from "../lib/trpc";
import { activityRouter } from "./activity";
import { githubIntegrationRouter } from "./github-integration";
import { labelRouter } from "./label";
import { notificationRouter } from "./notification";
import { projectRouter } from "./project";
import { searchRouter } from "./search";
import { taskRouter } from "./task";
import { timeEntryRouter } from "./time-entry";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  config: publicProcedure.query(async () => {
    const settings = getSettings();
    return settings;
  }),
  activity: activityRouter,
  githubIntegration: githubIntegrationRouter,
  label: labelRouter,
  notification: notificationRouter,
  project: projectRouter,
  search: searchRouter,
  task: taskRouter,
  timeEntry: timeEntryRouter,
});

export type AppRouter = typeof appRouter;
