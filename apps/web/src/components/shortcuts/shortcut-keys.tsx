import { SHORTCUTS, type ShortcutId } from "@/lib/shortcuts/catalog";
import { BindingKeys, type BindingKeysProps } from "./binding-keys";

type ShortcutKeysProps = Omit<BindingKeysProps, "bindings"> & {
  id: ShortcutId;
};

export function shortcutBindings(id: ShortcutId): readonly string[] {
  const definition = SHORTCUTS[id];
  return "display" in definition ? definition.display : definition.keys;
}

export function ShortcutKeys({ id, ...props }: ShortcutKeysProps) {
  return <BindingKeys bindings={shortcutBindings(id)} {...props} />;
}
