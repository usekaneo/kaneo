import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { parseBinding } from "./key-combo";
import { createShortcutRegistry, type ShortcutScope } from "./registry";

let registry: ReturnType<typeof createShortcutRegistry>;
const listener = (event: KeyboardEvent) => registry.handleKeyDown(event);

beforeEach(() => {
  vi.useFakeTimers();
  registry = createShortcutRegistry(true, 2000);
  document.addEventListener("keydown", listener);
});

afterEach(() => {
  document.removeEventListener("keydown", listener);
  document.body.innerHTML = "";
  vi.useRealTimers();
});

const add = (
  keys: string,
  handler = vi.fn(),
  scope: ShortcutScope = "global",
  extra: { allowInInput?: boolean; allowInPopup?: boolean } = {},
) => {
  const unregister = registry.register({
    bindings: keys.split("|").map(parseBinding),
    scope,
    handler,
    ...extra,
  });
  return { handler, unregister };
};

const press = (
  key: string,
  code: string,
  init: KeyboardEventInit = {},
  target: Element = document.body,
) => {
  const event = new KeyboardEvent("keydown", {
    key,
    code,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

describe("shortcut registry", () => {
  it("runs single keys and prevents the default action", () => {
    const { handler } = add("c");
    const event = press("c", "KeyC");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("runs two key sequences within the timeout only", () => {
    const { handler } = add("g i");
    press("g", "KeyG");
    press("i", "KeyI");
    expect(handler).toHaveBeenCalledTimes(1);

    press("g", "KeyG");
    vi.advanceTimersByTime(2100);
    press("i", "KeyI");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("falls back to single keys when a sequence does not continue", () => {
    const sequence = add("g i").handler;
    const single = add("c").handler;
    press("g", "KeyG");
    press("c", "KeyC");
    expect(sequence).not.toHaveBeenCalled();
    expect(single).toHaveBeenCalledTimes(1);
  });

  it("prefers the more specific scope, then the latest registration", () => {
    const global = add("s", vi.fn(), "global").handler;
    const task = add("s", vi.fn(), "task").handler;
    press("s", "KeyS");
    expect(task).toHaveBeenCalledTimes(1);
    expect(global).not.toHaveBeenCalled();

    const later = add("s", vi.fn(), "task");
    press("s", "KeyS");
    expect(later.handler).toHaveBeenCalledTimes(1);
    later.unregister();
    press("s", "KeyS");
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("ignores plain keys while typing unless allowed", () => {
    document.body.innerHTML = "<input /><div contenteditable='true'></div>";
    const input = document.querySelector("input") as Element;
    const plain = add("c").handler;
    const palette = add("mod+k", vi.fn(), "global", {
      allowInInput: true,
    }).handler;
    press("c", "KeyC", {}, input);
    press("k", "KeyK", { metaKey: true }, input);
    expect(plain).not.toHaveBeenCalled();
    expect(palette).toHaveBeenCalledTimes(1);

    const help = add("?|mod+/", vi.fn(), "global", {
      allowInInput: true,
    }).handler;
    press("?", "Slash", { shiftKey: true }, input);
    expect(help).not.toHaveBeenCalled();
    press("/", "Slash", { metaKey: true }, input);
    expect(help).toHaveBeenCalledTimes(1);
  });

  it("blocks shortcuts inside popups unless the popup allows them", () => {
    document.body.innerHTML =
      '<div role="menu"><button id="menu"></button></div><div role="dialog" data-shortcuts="allow"><button id="sheet"></button></div>';
    const { handler } = add("s", vi.fn(), "task");
    press("s", "KeyS", {}, document.getElementById("menu") as Element);
    expect(handler).not.toHaveBeenCalled();
    press("s", "KeyS", {}, document.getElementById("sheet") as Element);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("lets shortcuts through a popup that is animating closed", () => {
    document.body.innerHTML =
      '<div role="dialog" data-closed><button id="option"></button></div>';
    const { handler } = add("p", vi.fn(), "task");
    press("p", "KeyP", {}, document.getElementById("option") as Element);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("leaves Enter and Space to focused buttons", () => {
    document.body.innerHTML = "<button>Save</button>";
    const { handler } = add("enter");
    const event = press(
      "Enter",
      "Enter",
      {},
      document.querySelector("button") as Element,
    );
    expect(handler).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    press("Enter", "Enter");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("treats Enter and Space on a shortcut surface as shortcuts", () => {
    document.body.innerHTML =
      '<div role="button" tabindex="0" data-shortcut-surface><button id="inner"></button></div>';
    const surface = document.querySelector(
      "[data-shortcut-surface]",
    ) as Element;
    const { handler } = add("space");
    press(" ", "Space", {}, surface);
    expect(handler).toHaveBeenCalledTimes(1);
    press(" ", "Space", {}, document.getElementById("inner") as Element);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("supports alternative bindings and reports the pending key", () => {
    const { handler } = add("j|arrowdown");
    press("ArrowDown", "ArrowDown");
    press("j", "KeyJ");
    expect(handler).toHaveBeenCalledTimes(2);

    registry.register({
      id: "switchWorkspace",
      bindings: [parseBinding("o w")],
      scope: "global",
      handler: vi.fn(),
    });
    registry.register({
      id: "openProject",
      bindings: [parseBinding("o p")],
      scope: "global",
      handler: vi.fn(),
    });
    press("o", "KeyO");
    expect(registry.getPendingKey()).toBe("o");
    expect(
      registry.getContinuations().map((item) => [item.id, item.next.key]),
    ).toEqual([
      ["switchWorkspace", "w"],
      ["openProject", "p"],
    ]);
  });
});
