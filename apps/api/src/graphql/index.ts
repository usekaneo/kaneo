import { GraphQLSchema, GraphQLObjectType, GraphQLString } from 'graphql';
import { generatedSchema } from './schema';
import { customResolvers } from './resolvers';

export const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      ...generatedSchema.getQueryType()?.getFields(),
      tasksByStatus: {
        type: generatedSchema.getType('Task'),
        args: {
          status: { type: GraphQLString },
          projectId: { type: GraphQLString },
        },
        resolve: customResolvers.Query.tasksByStatus,
      },
    },
  }),
  mutation: new GraphQLObjectType({
    name: 'Mutation',
    fields: {
      ...generatedSchema.getMutationType()?.getFields(),
      updateTaskStatus: {
        type: generatedSchema.getType('Task'),
        args: {
          id: { type: GraphQLString },
          status: { type: GraphQLString },
        },
        resolve: customResolvers.Mutation.updateTaskStatus,
      },
    },
  }),
});