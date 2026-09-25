// `_` and `%` are wildcards to LIKE and ILIKE, and `\` is the escape character
// Postgres uses when no ESCAPE clause is given. A value compared with `ilike`
// has to go through here first, or a key holding one of them matches more rows
// than the one that was asked for.
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
