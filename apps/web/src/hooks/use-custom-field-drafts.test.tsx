import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCustomFieldDrafts } from "./use-custom-field-drafts";

describe("custom field drafts", () => {
  it("preserves dirty text and selections while refreshing clean fields", () => {
    const { result, rerender } = renderHook(
      ({ values }) => useCustomFieldDrafts("task", values),
      {
        initialProps: {
          values: { text: "Saved", people: ["Alice"], clean: "Old" },
        },
      },
    );
    act(() => {
      result.current.change("text", "Typing");
      result.current.change("people", ["Bob"]);
    });
    rerender({ values: { text: "Saved", people: ["Alex"], clean: "New" } });
    expect(result.current.values).toEqual({
      text: "Typing",
      people: ["Bob"],
      clean: "New",
    });
    act(() => result.current.finish("text", "Typing"));
    rerender({ values: { text: "Remote", people: ["Alex"], clean: "New" } });
    expect(result.current.values.text).toBe("Remote");
  });
  it("rolls back only the submitted edit and resets when switching tasks", () => {
    const { result, rerender } = renderHook(
      ({ id, values }) => useCustomFieldDrafts(id, values),
      { initialProps: { id: "one", values: { text: "Saved" } } },
    );
    act(() => result.current.change("text", "First"));
    act(() => result.current.change("text", "Second"));
    act(() => result.current.finish("text", "First", "Saved"));
    expect(result.current.values.text).toBe("Second");
    act(() => result.current.finish("text", "Second", "Saved"));
    expect(result.current.values.text).toBe("Saved");
    act(() => result.current.change("text", "Unfinished"));
    rerender({ id: "two", values: { text: "Other task" } });
    expect(result.current.values.text).toBe("Other task");
  });
});
