export function foldBrandCalls(source: string, filename: string): string;
export function brandCopyPlugin(): {
  name: string;
  transform(source: string, id: string): string | undefined;
};
