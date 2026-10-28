import { describe, expect, it } from "vite-plus/test";
import {
  altTextFor,
  appendToDescription,
  commentWithFiles,
  fileMarkdown,
  type UploadedFile,
} from "./attachment-markdown.js";

const shot: UploadedFile = {
  name: "login_page-v2.png",
  url: "http://localhost:1337/api/asset/a1",
  contentType: "image/png",
  size: 120,
  kind: "image",
};

const spec: UploadedFile = {
  name: 'spec "final".pdf',
  url: "http://localhost:1337/api/asset/p1",
  contentType: "application/pdf",
  size: 2048,
  kind: "attachment",
};

describe("fileMarkdown", () => {
  it("writes images the way the editor does", () => {
    expect(fileMarkdown(shot)).toBe(
      "![login page v2](http://localhost:1337/api/asset/a1)",
    );
    expect(
      fileMarkdown({ ...shot, name: "[draft].png", url: "http://h/a b" }),
    ).toBe("![\\[draft\\]](<http://h/a b>)");
  });

  it("writes other files as attachment tags", () => {
    expect(fileMarkdown(spec)).toBe(
      '<kaneo-attachment url="http://localhost:1337/api/asset/p1" filename="spec &quot;final&quot;.pdf" mime-type="application/pdf" size="2048" />',
    );
  });
});

describe("altTextFor", () => {
  it("turns a file name into readable alt text", () => {
    expect(altTextFor("Screen_Shot-2026.png")).toBe("Screen Shot 2026");
  });
});

describe("appendToDescription", () => {
  it("adds the files after the existing text", () => {
    expect(appendToDescription("Steps:\n\n1. Log in\n\n", [shot, spec])).toBe(
      `Steps:\n\n1. Log in\n\n${fileMarkdown(shot)}\n\n${fileMarkdown(spec)}`,
    );
  });

  it("uses the files alone for an empty description", () => {
    expect(appendToDescription(null, [shot])).toBe(fileMarkdown(shot));
    expect(appendToDescription("  \n", [shot])).toBe(fileMarkdown(shot));
  });
});

describe("commentWithFiles", () => {
  it("puts the message first", () => {
    expect(commentWithFiles(" Broken here ", [shot])).toBe(
      `Broken here\n\n${fileMarkdown(shot)}`,
    );
    expect(commentWithFiles("", [shot])).toBe(fileMarkdown(shot));
  });
});
