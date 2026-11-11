import { z } from "zod";

const optionalCode = z.string().optional().catch(undefined);
const optionalStatus = z.number().optional().catch(undefined);
const storageErrorSchema = z.object({
  name: z.string().catch("Error"),
  code: optionalCode,
  Code: optionalCode,
  cause: z.object({ code: optionalCode }).optional().catch(undefined),
  statusCode: optionalStatus,
  $metadata: z
    .object({ httpStatusCode: optionalStatus })
    .optional()
    .catch(undefined),
  $response: z
    .object({ statusCode: optionalStatus })
    .optional()
    .catch(undefined),
});

export function describeStorageError(error: unknown): {
  name: string;
  status?: number;
  code?: string;
} {
  if (typeof error !== "object" || error === null) {
    return { name: typeof error };
  }
  const parsed = storageErrorSchema.safeParse(error);
  if (!parsed.success) return { name: "Error" };
  const shape = parsed.data;
  const status =
    shape.$metadata?.httpStatusCode ??
    shape.$response?.statusCode ??
    shape.statusCode;
  const code = shape.Code ?? shape.code ?? shape.cause?.code;
  return {
    name: shape.name,
    ...(status !== undefined ? { status } : {}),
    ...(code !== undefined ? { code } : {}),
  };
}
