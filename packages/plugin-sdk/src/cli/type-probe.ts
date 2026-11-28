import { readDeclaredType } from "./declared-type.js";

export type ProbedTypes = {
  input: string;
  output: string;
  optional: boolean;
};

export function createTypeProbe(indexSpecifier: string): string {
  return `import plugin from ${JSON.stringify(indexSpecifier)};

type Simplify<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends Date | RegExp
    ? T
    : T extends object
      ? { [K in keyof T]: Simplify<T[K]> } & {}
      : T;

type Factory = typeof plugin;
type Arguments = Parameters<Factory>;
type Output = NonNullable<ReturnType<Factory>["~output"]>;

declare function infer<T>(): T;

export const input = infer<Simplify<NonNullable<Arguments[0]>>>();
export const output = infer<Simplify<Output>>();
export const optional = infer<[] extends Arguments ? true : false>();
`;
}

export function readProbedTypes(declaration: string): ProbedTypes | null {
  const input = readDeclaredType(declaration, "input");
  const output = readDeclaredType(declaration, "output");
  const optional = readDeclaredType(declaration, "optional");
  if (!input || !output || !optional) return null;
  return { input, output, optional: optional !== "false" };
}
