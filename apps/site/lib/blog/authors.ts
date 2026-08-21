import type { BlogAuthor } from "./types";

const all: BlogAuthor[] = [
  {
    id: "andrej",
    name: "Andrej Acevski",
    role: "Founder, Kaneo",
    url: "https://github.com/andrejsshell",
  },
  {
    id: "kaneo-team",
    name: "The Kaneo team",
    role: "Kaneo",
    url: "https://github.com/usekaneo/kaneo",
  },
];

export const authorList = all;

export const authors: Record<string, BlogAuthor> = Object.fromEntries(
  all.map((author) => [author.id, author]),
);
