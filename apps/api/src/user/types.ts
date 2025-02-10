import type { InferSelectModel } from 'drizzle-orm';
import type { sessionTable, userTable } from '../database/schema';

export type User = InferSelectModel<typeof userTable>;
export type Session = InferSelectModel<typeof sessionTable>;

export type SessionValidationResult =
  | { session: Session; user: User }
  | { session: null; user: null };
