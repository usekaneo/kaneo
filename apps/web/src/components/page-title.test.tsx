import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import PageTitle from "./page-title";

describe("PageTitle", () => {
  beforeEach(() => {
    document.title = "Kaneo";
  });

  afterEach(cleanup);

  it("sets the document title", () => {
    render(<PageTitle title="MFP-1 Drag this card" />);
    expect(document.title).toBe("MFP-1 Drag this card");
  });

  it("keeps the fallback title while the title is still loading", () => {
    const { rerender } = render(<PageTitle title={undefined} />);
    expect(document.title).toBe("Kaneo");

    rerender(<PageTitle title="Website / Board" />);
    expect(document.title).toBe("Website / Board");
  });

  it("restores the fallback title when the page unmounts", () => {
    const { unmount } = render(<PageTitle title="Inbox" />);
    unmount();
    expect(document.title).toBe("Kaneo");
  });
});
