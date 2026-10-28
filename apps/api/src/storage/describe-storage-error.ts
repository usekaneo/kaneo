type StorageErrorShape = {
  name?: unknown;
  code?: unknown;
  Code?: unknown;
  cause?: { code?: unknown };
  $metadata?: { httpStatusCode?: unknown };
  $response?: { statusCode?: unknown };
};

export function describeStorageError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return { name: typeof error };
  }
  const shape = error as StorageErrorShape;
  const status = shape.$metadata?.httpStatusCode ?? shape.$response?.statusCode;
  const code = shape.Code ?? shape.code ?? shape.cause?.code;
  return {
    name: typeof shape.name === "string" ? shape.name : "Error",
    ...(typeof status === "number" ? { status } : {}),
    ...(typeof code === "string" ? { code } : {}),
  };
}
