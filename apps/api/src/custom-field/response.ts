import { responseTimestamp, z } from "../openapi";

export const customFieldDefinitionSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    defaultValue: z.string().nullable(),
    options: z.unknown().nullable(),
    position: z.number(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("CustomFieldDefinition");

export const customFieldDefinitionListSchema = z.array(
  customFieldDefinitionSchema,
);

export const customFieldValueSchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    fieldId: z.string(),
    value: z.string().nullable(),
    fieldName: z.string(),
    fieldPosition: z.number(),
    fieldType: z.string(),
    fieldOptions: z.unknown().nullable(),
  })
  .openapi("CustomFieldValue");

export const customFieldValueListSchema = z.array(customFieldValueSchema);

export const customFieldFilterValuesSchema = z
  .object({
    fieldId: z.string(),
    fieldName: z.string(),
    fieldType: z.string(),
    values: z.array(z.string()),
  })
  .openapi("CustomFieldFilterValues");

export const customFieldFilterValuesListSchema = z.array(
  customFieldFilterValuesSchema,
);

export const setCustomFieldValueResponseSchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    fieldId: z.string(),
    value: z.string().nullable(),
  })
  .openapi("SetCustomFieldValueResponse");

export const reorderCustomFieldsResponseSchema = z
  .unknown()
  .openapi("ReorderCustomFieldsResponse");
