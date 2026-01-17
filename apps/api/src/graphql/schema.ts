import { buildSchema } from 'drizzle-graphql';
import db from '../database';

export const { schema: generatedSchema, entities } = buildSchema(db);