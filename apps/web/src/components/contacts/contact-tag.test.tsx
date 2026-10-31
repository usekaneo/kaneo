import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { ContactTag } from "./contact-tag";

vi.mock("@/hooks/queries/contact/use-contact-name", () => ({
  useContactName: (id: string) => (id === "c-1" ? "Ali Stores" : null),
}));

describe("ContactTag", () => {
  it("shows the contact's name for a lead", () => {
    render(<ContactTag contactId="c-1" />);
    expect(screen.getByText("Ali Stores")).toBeTruthy();
  });

  it("renders nothing for an ordinary task or an unknown contact", () => {
    const { container, rerender } = render(<ContactTag contactId={null} />);
    expect(container.firstChild).toBeNull();
    rerender(<ContactTag contactId="missing" />);
    expect(container.firstChild).toBeNull();
  });
});
