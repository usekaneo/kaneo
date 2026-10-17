import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { createProgressThrottle } from "./progress-throttle";

describe("createProgressThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes the first message at once and then at most once per interval", () => {
    const write = vi.fn();
    const throttle = createProgressThrottle(write, 1000);

    throttle.report("Reading cards (1 of 9)");
    throttle.report("Reading cards (2 of 9)");
    throttle.report("Reading cards (3 of 9)");
    expect(write.mock.calls).toEqual([["Reading cards (1 of 9)"]]);

    vi.advanceTimersByTime(999);
    expect(write).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(write.mock.calls.at(-1)).toEqual(["Reading cards (3 of 9)"]);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("drops a pending message when cancelled", () => {
    const write = vi.fn();
    const throttle = createProgressThrottle(write, 1000);

    throttle.report("first");
    throttle.report("second");
    throttle.cancel();
    vi.advanceTimersByTime(5000);

    expect(write.mock.calls).toEqual([["first"]]);
  });
});
