import { describe, expect, it } from "vite-plus/test";
import { detectCodeLanguage } from "./detect-code-language";

describe("detectCodeLanguage", () => {
  it.each([
    ["const a = 'a';", "javascript"],
    ["console.log('hi')", "javascript"],
    ["import { x } from './x';\nexport default x;", "javascript"],
    ["let total: number = 1;", "typescript"],
    ["interface Task { title: string }", "typescript"],
    ['{"a": 1, "b": [1, 2]}', "json"],
    ["def add(a, b):\n    return a + b", "python"],
    ["import os\nos.getcwd()", "python"],
    ['fn main() {\n    println!("hi");\n}', "rust"],
    ["package main\n\nfunc main() {}", "go"],
    ["func greet(name: String) -> String {", "swift"],
    ["public class App { public static void main(String[] args) {} }", "java"],
    ["using System;\nConsole.WriteLine(1);", "csharp"],
    ["fun main() {\n    val x = 1\n}", "kotlin"],
    ["def greet\n  puts 'hi'\nend", "ruby"],
    ["<?php echo $name;", "php"],
    ["SELECT id FROM users WHERE id = 1;", "sql"],
    ["query Tasks {\n  tasks { id }\n}", "graphql"],
    ['<div class="card">Hi</div>', "html"],
    ['<?xml version="1.0"?><note/>', "xml"],
    ["pnpm install\npnpm dev", "bash"],
    [".card { color: red; }", "css"],
    ["name: kaneo\nversion: 2\nservices:\n  - api", "yaml"],
    ["@@ -1,2 +1,2 @@\n-a\n+b", "diff"],
    ["# Title\n\n- [ ] task", "markdown"],
  ])("detects %j as %s", (code, language) => {
    expect(detectCodeLanguage(code)).toBe(language);
  });

  it("leaves prose and empty blocks as plain text", () => {
    expect(detectCodeLanguage("hello world")).toBeNull();
    expect(detectCodeLanguage("   ")).toBeNull();
  });
});
