import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Separator } from "./separator";

describe("Separator", () => {
	it("renders a horizontal separator", () => {
		render(<Separator />);
		expect(screen.getByRole("separator")).toBeInTheDocument();
	});
});
