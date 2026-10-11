import { describe, expect, it } from "vite-plus/test";
import { SourceHttpError } from "../http.js";
import { jiraErrorText, toJiraError } from "./errors.js";

describe("jiraErrorText", () => {
  it("joins error messages and field errors", () => {
    expect(
      jiraErrorText({
        errorMessages: [
          "The value 'XYZ' does not exist for the field 'project'.",
        ],
        errors: { jql: "Bad order" },
      }),
    ).toBe("The value 'XYZ' does not exist for the field 'project'. Bad order");
    expect(jiraErrorText({ message: "Board not found" })).toBe(
      "Board not found",
    );
  });

  it("ignores bodies without messages", () => {
    expect(jiraErrorText({ errorMessages: [], errors: {} })).toBeUndefined();
    expect(jiraErrorText("<html></html>")).toBeUndefined();
    expect(jiraErrorText(null)).toBeUndefined();
  });

  it("shortens long messages", () => {
    const text = jiraErrorText({ errorMessages: ["x".repeat(400)] });
    expect(text).toHaveLength(301);
  });
});

describe("toJiraError", () => {
  it("replaces 401 errors with the credential message and drops the body", () => {
    const error = toJiraError(
      new SourceHttpError("Jira /rest/api/3/myself: HTTP 401", 401, {
        echoed: "secret",
      }),
      "Jira rejected the personal access token.",
    ) as SourceHttpError;
    expect(error).toBeInstanceOf(SourceHttpError);
    expect(error.message).toBe("Jira rejected the personal access token.");
    expect(error.status).toBe(401);
    expect(error.body).toBeNull();
  });

  it("keeps the status and uses the Jira message", () => {
    const error = toJiraError(
      new SourceHttpError("Jira /rest/api/2/search: HTTP 400", 400, {
        errorMessages: ["Field 'Rank' does not exist."],
      }),
      "rejected",
    ) as SourceHttpError;
    expect(error.message).toBe("Jira: Field 'Rank' does not exist.");
    expect(error.status).toBe(400);
  });

  it("passes other errors through", () => {
    const plain = new Error("network down");
    expect(toJiraError(plain, "rejected")).toBe(plain);
    const html = new SourceHttpError("Jira /x: HTTP 502", 502, "<html>");
    expect(toJiraError(html, "rejected")).toBe(html);
  });
});
