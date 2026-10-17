import { describe, expect, it } from "vite-plus/test";
import { MISSING_URL_MESSAGE, parseJiraUrl } from "./url.js";

describe("parseJiraUrl", () => {
  it.each([
    "https://acme.atlassian.net/jira/software/projects/ABC/boards/1",
    "acme.atlassian.net",
    "  ACME.atlassian.net/  ",
    "https://acme.atlassian.net/browse/ABC-12?focusedCommentId=1#top",
    "http://acme.atlassian.net/jira/your-work",
    "https://acme.atlassian.net/wiki/spaces/ENG",
  ])("reduces the Jira Cloud URL %s to the site", (url) => {
    expect(parseJiraUrl(url)).toEqual({
      baseUrl: url.trim().startsWith("http://")
        ? "http://acme.atlassian.net"
        : "https://acme.atlassian.net",
      cloud: true,
    });
  });

  it.each([
    ["https://jira.example.com/browse/ABC-1", "https://jira.example.com"],
    ["jira.example.com", "https://jira.example.com"],
    [
      "https://jira.example.com/secure/RapidBoard.jspa?rapidView=4",
      "https://jira.example.com",
    ],
    [
      "https://jira.example.com/projects/ABC/issues/ABC-1?filter=all",
      "https://jira.example.com",
    ],
    [
      "https://jira.example.com/issues/?jql=project%3DABC",
      "https://jira.example.com",
    ],
    ["https://jira.example.com/rest/api/2/myself", "https://jira.example.com"],
    [
      "https://jira.example.com/plugins/servlet/desk",
      "https://jira.example.com",
    ],
    ["https://jira.example.com/login.jsp", "https://jira.example.com"],
    ["https://jira.example.com:8443/", "https://jira.example.com:8443"],
  ])("keeps the Data Center origin for %s", (url, baseUrl) => {
    expect(parseJiraUrl(url)).toEqual({ baseUrl, cloud: false });
  });

  it.each([
    [
      "https://example.com/jira/secure/Dashboard.jspa",
      "https://example.com/jira",
    ],
    ["https://example.com/jira/browse/ABC-1", "https://example.com/jira"],
    ["https://example.com/jira/projects/ABC", "https://example.com/jira"],
    ["http://localhost:8080/jira/", "http://localhost:8080/jira"],
    [
      "https://example.com/tools/jira/issues/?jql=",
      "https://example.com/tools/jira",
    ],
    ["https://example.com/jira", "https://example.com/jira"],
    ["https://example.com/jira/login.jsp", "https://example.com/jira"],
  ])("keeps the context path of %s", (url, baseUrl) => {
    expect(parseJiraUrl(url)).toEqual({ baseUrl, cloud: false });
  });

  it("drops Cloud style app paths on other hosts", () => {
    expect(
      parseJiraUrl(
        "https://jira.example.com/jira/software/projects/ABC/boards/1",
      ),
    ).toEqual({ baseUrl: "https://jira.example.com", cloud: false });
  });

  it.each(["", "   ", "ftp://jira.example.com", "https://", null, undefined])(
    "asks for a site URL when given %j",
    (url) => {
      expect(() => parseJiraUrl(url)).toThrow(MISSING_URL_MESSAGE);
    },
  );
});
