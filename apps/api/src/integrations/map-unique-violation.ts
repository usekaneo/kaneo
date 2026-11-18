// Postgres reports a broken unique constraint as error code 23505 on the
// driver error. Naming the shape lets controllers map those races back to
// meaningful 409 responses instead of leaking a 500.
export type DatabaseUniqueViolation = Error & {
  code?: string | undefined;
  constraint?: string | undefined;
};

export function isDatabaseUniqueViolation(
  error: unknown,
): error is DatabaseUniqueViolation {
  return (
    error instanceof Error &&
    (error as DatabaseUniqueViolation).code === "23505"
  );
}
