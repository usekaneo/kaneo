import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { ThemeProvider } from ".";

if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

function renderWith(palette: "kaneo" | "modern", theme: "light" | "dark") {
  useUserPreferencesStore.setState({ palette, theme });
  render(
    <ThemeProvider>
      <span />
    </ThemeProvider>,
  );
  return document.documentElement;
}

describe("ThemeProvider palette", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-palette");
    useUserPreferencesStore.setState({ theme: "dark", palette: "kaneo" });
  });

  it("sets no palette attribute for kaneo", () => {
    expect(renderWith("kaneo", "dark").dataset.palette).toBeUndefined();
  });

  it("sets data-palette for modern", () => {
    expect(renderWith("modern", "light").dataset.palette).toBe("modern");
  });
});
