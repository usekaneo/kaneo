import { afterEach, expect, it } from "vite-plus/test";
import { PLUGIN_HOST_GLOBAL } from "../shared-modules.js";
import { WeekStartControl } from "./index.js";

const host = globalThis as Record<string, unknown>;

afterEach(() => {
  delete host[PLUGIN_HOST_GLOBAL];
});

it("renders Kaneo's week start control", () => {
  const HostWeekStartControl = () => null;
  host[PLUGIN_HOST_GLOBAL] = { ui: { WeekStartControl: HostWeekStartControl } };

  expect(WeekStartControl().type).toBe(HostWeekStartControl);
});
