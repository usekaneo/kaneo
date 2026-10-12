import type getColumns from "@/fetchers/column/get-columns";

export type ProjectColumn = Awaited<ReturnType<typeof getColumns>>[number];
