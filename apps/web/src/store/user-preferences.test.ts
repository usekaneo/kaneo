import { afterEach, expect, it } from "vite-plus/test";
import { useUserPreferencesStore } from "./user-preferences";

afterEach(() => {
  localStorage.clear();
});

it("moves a stored core Gantt layout to the Gantt plugin when preferences load", async () => {
  localStorage.setItem(
    "user-preferences",
    JSON.stringify({
      state: { taskLayout: "gantt", viewMode: "list" },
      version: 0,
    }),
  );

  await useUserPreferencesStore.persist.rehydrate();

  const state = useUserPreferencesStore.getState();
  expect(state.taskLayout).toBe("plugin:gantt:timeline");
  expect(state.viewMode).toBe("list");
});
