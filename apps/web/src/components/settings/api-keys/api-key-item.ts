import type useGetApiKeys from "@/hooks/queries/use-get-api-keys";

export type ApiKeyItem = NonNullable<
  ReturnType<typeof useGetApiKeys>["data"]
>[number];
