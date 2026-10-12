import type { LucideIcon } from "lucide-react";
import { toastManager } from "@/components/ui/toast";

type ToastVariant = "success" | "error" | "info" | "warning";

type ToastAction = {
  label: string;
  onClick?: () => void;
};

type ToastOptions = {
  description?: string;
  icon?: LucideIcon;
  action?: ToastAction;
  cancel?: ToastAction;
};

let repeat = 0;

function addToast(
  title: string,
  variant?: ToastVariant,
  options?: ToastOptions,
) {
  const id = `${variant ?? "message"}:${title}:${options?.description ?? ""}`;
  const action = options?.action ?? options?.cancel;
  repeat += 1;

  return toastManager.add({
    id,
    title,
    data: { repeat, icon: options?.icon },
    description: options?.description,
    type: variant,
    actionProps: action
      ? {
          children: action.label,
          onClick: () => {
            action.onClick?.();
            toastManager.close(id);
          },
        }
      : undefined,
  });
}

type ToastFn = (title: string, options?: ToastOptions) => string;
type ToastId = string;

const success: ToastFn = (title, options) =>
  addToast(title, "success", options);
const error: ToastFn = (title, options) => addToast(title, "error", options);
const info: ToastFn = (title, options) => addToast(title, "info", options);
const warning: ToastFn = (title, options) =>
  addToast(title, "warning", options);
const message: ToastFn = (title, options) =>
  addToast(title, undefined, options);
const loading: ToastFn = (title, options) =>
  toastManager.add({
    title,
    description: options?.description,
    type: "loading",
  });
const dismiss = (id?: ToastId) => {
  if (!id) return;
  toastManager.close(id);
};

const toast = Object.assign(message, {
  success,
  error,
  info,
  warning,
  message,
  loading,
  dismiss,
});

export type { ToastOptions };
export { toast };
