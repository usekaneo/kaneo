export type ViewConfigScope = "workspace" | "project" | "user";

export type ViewConfigLayer = {
  scope: ViewConfigScope;
  configuration: Record<string, unknown>;
};

const scopePrecedence: Record<ViewConfigScope, number> = {
  workspace: 0,
  project: 1,
  user: 2,
};

export default function resolveViewConfig(
  layers: ViewConfigLayer[],
): Record<string, unknown> {
  return [...layers]
    .sort(
      (left, right) =>
        scopePrecedence[left.scope] - scopePrecedence[right.scope],
    )
    .reduce((configuration, layer) => {
      for (const [key, value] of Object.entries(layer.configuration)) {
        Object.defineProperty(configuration, key, {
          configurable: true,
          enumerable: true,
          value,
          writable: true,
        });
      }

      return configuration;
    }, {});
}
