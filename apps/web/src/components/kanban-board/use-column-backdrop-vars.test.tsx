import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_COLUMN_BACKDROP,
  useUserPreferencesStore,
} from "@/store/user-preferences";
import { useColumnBackdropVars } from "./use-column-backdrop-vars";

function Board() {
  return <div data-testid="board" ref={useColumnBackdropVars()} />;
}

afterEach(() => {
  cleanup();
  const state = useUserPreferencesStore.getState();
  state.setColumnOpacity(DEFAULT_COLUMN_BACKDROP.opacity);
  state.setColumnBlur(DEFAULT_COLUMN_BACKDROP.blur);
});

describe("useColumnBackdropVars", () => {
  it("sets the column opacity and blur and follows changes", () => {
    render(<Board />);
    const board = screen.getByTestId("board");
    expect(board.style.getPropertyValue("--column-backdrop-opacity")).toBe(
      `${DEFAULT_COLUMN_BACKDROP.opacity}%`,
    );
    expect(board.style.getPropertyValue("--column-backdrop-blur")).toBe(
      `${DEFAULT_COLUMN_BACKDROP.blur}px`,
    );

    act(() => {
      useUserPreferencesStore.getState().setColumnOpacity(35);
      useUserPreferencesStore.getState().setColumnBlur(0);
    });

    expect(board.style.getPropertyValue("--column-backdrop-opacity")).toBe(
      "35%",
    );
    expect(board.style.getPropertyValue("--column-backdrop-blur")).toBe("0px");
  });
});
