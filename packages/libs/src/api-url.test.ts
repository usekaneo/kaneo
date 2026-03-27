import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "./api-url";

describe("resolveApiBaseUrl", () => {
	it("appends /api when the base has no api suffix", () => {
		expect(resolveApiBaseUrl(undefined)).toBe("http://localhost:1337/api");
		expect(resolveApiBaseUrl("http://localhost:1337")).toBe(
			"http://localhost:1337/api",
		);
	});

	it("returns the URL unchanged when it already ends with /api", () => {
		expect(resolveApiBaseUrl("http://localhost:1337/api")).toBe(
			"http://localhost:1337/api",
		);
	});
});
