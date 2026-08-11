import { describe, expect, it } from "vitest";
import {
  boardProjectName,
  buildDescription,
  formatComment,
  planColumns,
  sortCards,
  toDueDate,
} from "./mapping.js";
import type { PlankaCard, PlankaList } from "./planka.js";

function list(partial: Partial<PlankaList> & { id: string }): PlankaList {
  return {
    boardId: "b1",
    name: "List",
    type: "active",
    position: 0,
    color: null,
    ...partial,
  };
}

function card(partial: Partial<PlankaCard> & { id: string }): PlankaCard {
  return {
    boardId: "b1",
    listId: "l1",
    name: "Card",
    description: null,
    position: 0,
    dueDate: null,
    isDueCompleted: null,
    isClosed: null,
    commentsTotal: 0,
    ...partial,
  };
}

describe("planColumns", () => {
  it("orders by position and marks closed lists as final", () => {
    const planned = planColumns([
      list({ id: "b", name: "Done", type: "closed", position: 2 }),
      list({ id: "a", name: "To Do", position: 1 }),
    ]);

    expect(planned.map((column) => column.slug)).toEqual(["to-do", "done"]);
    expect(planned.map((column) => column.isFinal)).toEqual([false, true]);
  });

  it("renames lists whose slug is a reserved virtual status", () => {
    const [planned] = planColumns([list({ id: "a", name: "Planned" })]);

    expect(planned?.slug).toBe("planned-list");
    expect(planned?.renamedFrom).toBe("Planned");
  });

  it("disambiguates lists that would collide on slug", () => {
    const planned = planColumns([
      list({ id: "a", name: "In Review", position: 0 }),
      list({ id: "b", name: "in review", position: 1 }),
      list({ id: "c", name: "In  Review", position: 2 }),
    ]);

    expect(new Set(planned.map((column) => column.slug)).size).toBe(3);
    expect(planned[1]?.renamedFrom).toBe("in review");
  });

  it("falls back to a usable name when the list name has no alphanumerics", () => {
    const [planned] = planColumns([list({ id: "a", name: "???" })]);

    expect(planned?.slug).toBe("untitled");
  });

  it("handles a null list name", () => {
    const [planned] = planColumns([list({ id: "a", name: null })]);

    expect(planned?.slug).toBe("untitled");
  });
});

describe("sortCards", () => {
  it("sorts by position without mutating the input", () => {
    const input = [
      card({ id: "b", position: 2 }),
      card({ id: "a", position: 1 }),
    ];
    const sorted = sortCards(input);

    expect(sorted.map((c) => c.id)).toEqual(["a", "b"]);
    expect(input.map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("buildDescription", () => {
  it("returns the description alone when there are no checklists", () => {
    const result = buildDescription(
      card({ id: "a", description: "Ship it" }),
      [],
      [],
    );

    expect(result).toBe("Ship it");
  });

  it("appends checklists as markdown checkboxes in position order", () => {
    const result = buildDescription(
      card({ id: "a", description: "Ship it" }),
      [{ id: "tl1", cardId: "a", name: "Steps" }],
      [
        {
          id: "t2",
          taskListId: "tl1",
          name: "Second",
          isCompleted: false,
          position: 2,
        },
        {
          id: "t1",
          taskListId: "tl1",
          name: "First",
          isCompleted: true,
          position: 1,
        },
      ],
    );

    expect(result).toBe("Ship it\n\n## Steps\n\n- [x] First\n- [ ] Second");
  });

  it("skips empty checklists and handles a card with no description", () => {
    const result = buildDescription(
      card({ id: "a", description: null }),
      [{ id: "tl1", cardId: "a", name: "Empty" }],
      [],
    );

    expect(result).toBe("");
  });
});

describe("formatComment", () => {
  it("keeps the body clean and notes the original date", () => {
    const result = formatComment(
      {
        id: "c1",
        cardId: "a",
        userId: "u1",
        text: "Looks good",
        createdAt: "2026-03-04T10:00:00.000Z",
      },
      { id: "u1", email: "sam@example.com", name: "Sam", username: null },
    );

    expect(result).toBe("Looks good\n\n_Originally posted on 2026-03-04._");
  });

  it("returns the text unchanged when there is no date", () => {
    const result = formatComment(
      {
        id: "c1",
        cardId: "a",
        userId: null,
        text: "Orphaned",
        createdAt: null,
      },
      undefined,
    );

    expect(result).toBe("Orphaned");
  });
});

describe("toDueDate", () => {
  it("normalizes a valid due date", () => {
    expect(
      toDueDate(card({ id: "a", dueDate: "2026-03-04T10:00:00.000Z" })),
    ).toBe("2026-03-04T10:00:00.000Z");
  });

  it("drops missing or unparseable dates", () => {
    expect(toDueDate(card({ id: "a", dueDate: null }))).toBeUndefined();
    expect(toDueDate(card({ id: "a", dueDate: "not-a-date" }))).toBeUndefined();
  });
});

describe("boardProjectName", () => {
  it("uses the project name when it has a single board", () => {
    expect(boardProjectName("Marketing", "Main", 1)).toBe("Marketing");
  });

  it("qualifies with the board name when the project has several", () => {
    expect(boardProjectName("Marketing", "Campaigns", 3)).toBe(
      "Marketing - Campaigns",
    );
  });
});
