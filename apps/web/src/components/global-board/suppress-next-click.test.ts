import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { suppressNextClick } from "./suppress-next-click";

function click() {
  const link = document.createElement("a");
  link.href = "#task";
  document.body.append(link);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  link.remove();
  return event.defaultPrevented;
}

afterEach(() => vi.useRealTimers());

describe("suppressNextClick", () => {
  it("cancels the click that ends a drag, and only that one", () => {
    suppressNextClick();
    expect(click()).toBe(true);
    expect(click()).toBe(false);
  });

  it("stops guarding when the drop produced no click", () => {
    vi.useFakeTimers();
    suppressNextClick();
    vi.advanceTimersByTime(50);
    expect(click()).toBe(false);
  });
});
