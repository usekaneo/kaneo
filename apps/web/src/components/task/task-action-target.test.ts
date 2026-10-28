import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import {
  clickTaskAction,
  findTaskAction,
  focusTaskAction,
} from "./task-action-target";

beforeEach(() => {
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (
    this: Element,
  ) {
    return (this.closest("[hidden]")
      ? []
      : [new DOMRect()]) as unknown as DOMRectList;
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("findTaskAction", () => {
  it("picks the visible action inside a task view", () => {
    document.body.innerHTML = `
      <button data-task-action="status" id="outside"></button>
      <div data-task-view hidden><button data-task-action="status" id="hidden"></button></div>
      <div data-task-view><button data-task-action="status" id="visible"></button></div>
    `;

    expect(findTaskAction("status")?.id).toBe("visible");
  });

  it("returns nothing when no task view shows the action", () => {
    document.body.innerHTML = `<button data-task-action="status"></button>`;

    expect(findTaskAction("status")).toBeNull();
  });
});

describe("clickTaskAction", () => {
  it("clicks the visible action", () => {
    document.body.innerHTML = `<div data-task-view><button data-task-action="priority"></button></div>`;
    const onClick = vi.fn();
    document
      .querySelector("[data-task-action]")
      ?.addEventListener("click", onClick);

    clickTaskAction("priority");

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("focusTaskAction", () => {
  it("focuses and selects a text field action", () => {
    document.body.innerHTML = `<div data-task-view><textarea data-task-action="title">Fix login</textarea></div>`;
    const field = document.querySelector("textarea") as HTMLTextAreaElement;

    focusTaskAction("title");

    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe("Fix login".length);
  });

  it("prefers the rich text editor over a file input", () => {
    document.body.innerHTML = `<div data-task-view><section data-task-action="description"><input type="file" /><div class="ProseMirror" contenteditable="true" id="editor">Notes</div></section></div>`;

    focusTaskAction("description");

    expect(document.activeElement?.id).toBe("editor");
  });

  it("focuses the editor inside a wrapper action", () => {
    document.body.innerHTML = `<div data-task-view><section data-task-action="comment"><textarea id="editor"></textarea></section></div>`;

    focusTaskAction("comment");

    expect(document.activeElement?.id).toBe("editor");
  });
});
