import { createInsertSchema, createSelectSchema } from 'drizzle-typebox';
import { t } from 'elysia';
import { userTable } from '../../database/schema';

export const signUpUserSchema = createInsertSchema(userTable, {
  email: t.String({ format: 'email' }),
  password: t.String(),
  name: t.String(),
});

export const signInUserSchema = createSelectSchema(userTable, {
  email: t.String({ format: 'email' }),
  password: t.String(),
});
