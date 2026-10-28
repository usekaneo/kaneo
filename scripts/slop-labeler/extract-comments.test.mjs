import assert from "node:assert/strict";
import { test } from "node:test";
import { changedComments } from "./extract-comments.mjs";

test("ignores strings, regexes and JSX text while grouping actual changed comments", () => {
  const source = [
    "const literal = `// not a comment`;",
    "const pattern = /https?:\\/\\//;",
    "const node = <div>/* ordinary JSX text */</div>;",
    "// A real explanation about the source follows.",
    "// Another line continues the explanation.",
    "const value = 1; /* This is another real explanation. */",
  ].join("\n");
  const comments = changedComments(
    source,
    "source.tsx",
    new Set([1, 2, 3, 4, 5, 6]),
  );
  assert.equal(comments.length, 2);
  assert.equal(comments[0].line, 4);
  assert.equal(comments[0].text.split("\n").length, 2);
  assert.equal(comments[1].line, 6);
});

test("includes a whole changed block, but skips untouched and deleted comments", () => {
  const source =
    "// Existing unchanged explanation.\nconst x = 1;\n/* First block line.\n * Updated explanation on this line.\n */\nconst y = 2;";
  const comments = changedComments(source, "source.ts", new Set([2, 4]));
  assert.equal(comments.length, 1);
  assert.equal(comments[0].line, 3);
  assert.match(comments[0].text, /First block line/);
  assert.equal(changedComments(source, "source.ts", new Set()).length, 0);
});

test("skips commented-out code and machine-readable metadata", () => {
  const source =
    '// const value = calculate();\n// send(value);\n/* __GDPR__ { "event": {} } */\n// This explanation says why calculate() must happen before sending.\nconst x = 1;';
  const comments = changedComments(source, "source.js", new Set([1, 2, 3, 4]));
  assert.equal(comments.length, 1);
  assert.match(comments[0].text, /This explanation/);
});

test("supports TypeScript assertions and legacy decorators without executing source", () => {
  const source =
    "// This explains the decorated class.\n@decorator()\nclass Example {}\nconst value = <string>input;\nglobalThis.__slopLabelerExecuted = true;";
  assert.equal(changedComments(source, "source.ts", new Set([1])).length, 1);
  assert.equal(globalThis.__slopLabelerExecuted, undefined);
});

test("supports Flow comments and real comments inside template expressions", () => {
  const source = `// This explains the value.\nconst value: number = 1;\nconst text = \`\${ /* An expression explanation. */ value }\`;`;
  assert.equal(changedComments(source, "source.js", new Set([1, 3])).length, 2);
});

test("invalid source prevents a confident partial scan", () => {
  assert.throws(() =>
    changedComments(
      "// Some explanation.\nconst = broken;",
      "source.ts",
      new Set([1]),
    ),
  );
});
