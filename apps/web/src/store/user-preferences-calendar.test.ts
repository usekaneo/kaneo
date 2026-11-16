import { afterEach, describe, expect, it } from "vite-plus/test";
import { useUserPreferencesStore } from "./user-preferences";

afterEach(() => {
  useUserPreferencesStore.getState().setCalendarWrapTaskTitles(false);
  useUserPreferencesStore.getState().setCalendarShowAllTasks(false);
});

describe("calendar display preferences", () => {
  it("stores both options independently and persists them", () => {
    const store = useUserPreferencesStore.getState();
    store.setCalendarWrapTaskTitles(true);
    expect(useUserPreferencesStore.getState().calendarWrapTaskTitles).toBe(true);
    expect(useUserPreferencesStore.getState().calendarShowAllTasks).toBe(false);
    store.setCalendarShowAllTasks(true);
    expect(useUserPreferencesStore.getState().calendarShowAllTasks).toBe(true);
    const state = JSON.parse(localStorage.getItem("user-preferences") ?? "{}");
    expect(state.state.calendarWrapTaskTitles).toBe(true);
    expect(state.state.calendarShowAllTasks).toBe(true);
  });
});
