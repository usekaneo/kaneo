import { GraphQLResolveInfo } from 'graphql';
import { db } from '../database';

export interface GraphQLContext {
  user?: { id: string; email: string };
  db: typeof db;
}

export type Resolver<TResult, TParent = any, TArgs = any> = (
  parent: TParent,
  args: TArgs,
  context: GraphQLContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;