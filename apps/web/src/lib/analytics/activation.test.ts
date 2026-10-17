import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { trackFirstTask, trackSignup } from "./activation";

const plausible = vi.fn();

beforeEach(() => {
  window.plausible = plausible;
});

afterEach(() => {
  delete window.plausible;
  localStorage.clear();
  plausible.mockReset();
});

describe("trackSignup", () => {
  it("records a signup once per user on this device", () => {
    trackSignup({ id: "user-1" });
    trackSignup({ id: "user-1" });

    expect(plausible).toHaveBeenCalledTimes(1);
    expect(plausible).toHaveBeenCalledWith("Signup", {
      props: { guest: false },
    });
  });

  it("marks guest accounts", () => {
    trackSignup({ id: "guest-1", isAnonymous: true });

    expect(plausible).toHaveBeenCalledWith("Signup", {
      props: { guest: true },
    });
  });

  it("stores nothing when analytics is not loaded", () => {
    delete window.plausible;

    trackSignup({ id: "user-1" });

    expect(localStorage.length).toBe(0);
  });
});

describe("trackFirstTask", () => {
  it("records the first task only after a signup on this device", () => {
    trackFirstTask();
    expect(plausible).not.toHaveBeenCalled();

    trackSignup({ id: "user-1" });
    trackFirstTask();
    trackFirstTask();

    expect(plausible).toHaveBeenCalledWith("First Task", undefined);
    expect(
      plausible.mock.calls.filter(([event]) => event === "First Task"),
    ).toHaveLength(1);
  });
});
