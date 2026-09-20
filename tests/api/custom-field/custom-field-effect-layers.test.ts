import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import createCustomField from "../../../apps/api/src/custom-field/controllers/create-custom-field";
import deleteCustomField from "../../../apps/api/src/custom-field/controllers/delete-custom-field";
import setCustomFieldValue from "../../../apps/api/src/custom-field/controllers/set-custom-field-value";
import {
  CustomFieldOrProjectNotFound,
  InvalidCustomFieldDefinition,
  InvalidCustomFieldValue,
  ProjectWithoutWorkspace,
} from "../../../apps/api/src/custom-field/errors";
import { NotFound } from "../../../apps/api/src/effect/errors";
import { makeTestDatabase } from "../../../apps/api/src/effect/testing";

const TASK = { id: "task-1", projectId: "proj-1", workspaceId: "ws-1" };

const FIELD = {
  id: "field-1",
  projectId: "proj-1",
  name: "Severity",
  type: "dropdown",
  required: true,
  defaultValue: "low",
  options: ["low", "high"],
  position: 1,
  createdAt: new Date("2026-09-18T10:00:00.000Z"),
  updatedAt: new Date("2026-09-18T10:00:00.000Z"),
};

function failureOf(effect: Effect.Effect<unknown, unknown>) {
  return Effect.runPromise(effect).then(
    () => {
      throw new Error("expected the effect to fail");
    },
    (error: unknown) => error,
  );
}

function selectSequence(results: unknown[][]) {
  const queue = [...results];
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => {
      const rows = queue.shift() ?? [];
      return Object.assign(Promise.resolve(rows), {
        limit: () => Promise.resolve(rows),
      });
    },
  };
  return () => chain;
}

describe("custom-field controllers through the Effect test layers", () => {
  it("createCustomField fails with NotFound for an unknown project", async () => {
    const database = makeTestDatabase({
      query: { projectTable: { findFirst: () => Promise.resolve(undefined) } },
    });

    const error = await failureOf(
      Effect.provide(
        createCustomField("missing", "Severity", "text", false),
        database,
      ),
    );

    expect(error).toBeInstanceOf(NotFound);
    expect(error).toMatchObject({ entity: "Project", id: "missing" });
  });

  it("createCustomField reports the failing definition rule", async () => {
    const database = makeTestDatabase({
      query: {
        projectTable: { findFirst: () => Promise.resolve({ id: "proj-1" }) },
      },
    });

    const cases: Array<[Parameters<typeof createCustomField>, string]> = [
      [["proj-1", "A", "text", true], "required-default"],
      [["proj-1", "A", "number", false, "abc"], "number-default"],
      [["proj-1", "A", "boolean", false, "yes"], "boolean-default"],
      [["proj-1", "A", "date", false, "not a date"], "date-default"],
      [["proj-1", "A", "dropdown", false, "c", ["a", "b"]], "dropdown-default"],
      [["proj-1", "A", "dropdown", false], "dropdown-options"],
    ];

    for (const [args, reason] of cases) {
      const error = await failureOf(
        Effect.provide(createCustomField(...args), database),
      );
      expect(error).toBeInstanceOf(InvalidCustomFieldDefinition);
      expect(error).toMatchObject({ reason });
    }
  });

  it("deleteCustomField distinguishes a missing field from a workspace-less project", async () => {
    const missing = makeTestDatabase({ select: selectSequence([[]]) });
    const orphan = makeTestDatabase({
      select: selectSequence([[{ projectId: "proj-1", workspaceId: null }]]),
    });

    await expect(
      failureOf(Effect.provide(deleteCustomField("field-9"), missing)),
    ).resolves.toBeInstanceOf(CustomFieldOrProjectNotFound);
    await expect(
      failureOf(Effect.provide(deleteCustomField("field-1"), orphan)),
    ).resolves.toBeInstanceOf(ProjectWithoutWorkspace);
  });

  it("setCustomFieldValue treats a field from another project as not found", async () => {
    const database = makeTestDatabase({
      select: selectSequence([[TASK], [{ ...FIELD, projectId: "proj-2" }]]),
    });

    const error = await failureOf(
      Effect.provide(setCustomFieldValue("task-1", "field-1", "low"), database),
    );

    expect(error).toBeInstanceOf(NotFound);
    expect(error).toMatchObject({ entity: "Custom field", id: "field-1" });
  });

  it("setCustomFieldValue validates by field type", async () => {
    const cases: Array<[Record<string, unknown>, string, string]> = [
      [{ required: true }, "   ", "required"],
      [{ type: "dropdown" }, "medium", "option"],
      [{ type: "number", options: null }, "abc", "number"],
      [{ type: "boolean", options: null }, "maybe", "boolean"],
    ];

    for (const [overrides, value, reason] of cases) {
      const database = makeTestDatabase({
        select: selectSequence([[TASK], [{ ...FIELD, ...overrides }]]),
      });
      const error = await failureOf(
        Effect.provide(
          setCustomFieldValue("task-1", "field-1", value),
          database,
        ),
      );
      expect(error).toBeInstanceOf(InvalidCustomFieldValue);
      expect(error).toMatchObject({ fieldId: "field-1", reason });
    }
  });

  it("setCustomFieldValue upserts the trimmed value", async () => {
    let inserted: Record<string, unknown> | undefined;
    const database = makeTestDatabase({
      select: selectSequence([[TASK], [FIELD]]),
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          inserted = values;
          return {
            onConflictDoUpdate: () => ({
              returning: () => Promise.resolve([{ id: "value-1", ...values }]),
            }),
          };
        },
      }),
    });

    const result = await Effect.runPromise(
      Effect.provide(
        setCustomFieldValue("task-1", "field-1", " high "),
        database,
      ),
    );

    expect(inserted).toEqual({
      taskId: "task-1",
      fieldId: "field-1",
      value: "high",
    });
    expect(result).toMatchObject({ id: "value-1", value: "high" });
  });
});
