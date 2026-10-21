import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vite-plus/test";
import { AssigneeAvatars } from "./assignee-avatars";
afterEach(cleanup);
it("bounds avatar rendering while exposing every assignee's name", () => {
  const people = Array.from({ length: 5 }, (_, i) => ({
    id: `person-${i}`,
    name: `Person ${i}`,
    image: null,
  }));
  const { container } = render(
    <AssigneeAvatars task={{ userId: people[0].id, assignees: people }} />,
  );
  expect(container.querySelectorAll('[data-slot="avatar"]')).toHaveLength(3);
  expect(screen.getByText("+2")).toBeInTheDocument();
  expect(
    screen.getByTitle(people.map((person) => person.name).join(", ")),
  ).toBeInTheDocument();
});
