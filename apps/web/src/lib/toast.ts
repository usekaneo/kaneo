import { toastManager } from "@/components/ui/toast";

type ToastVariant = "success" | "error" | "info" | "warning";

type ToastAction = {
  label: string;
  onClick?: () => void;
};

type ToastOptions = {
  description?: string;
  action?: ToastAction;
  cancel?: ToastAction;
};

function addToast(
  title: string,
  variant?: ToastVariant,
  options?: ToastOptions,
) {
  let id = "";

  const action = options?.action ?? options?.cancel;

  id = toastManager.add({
    title,
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

  return id;
}

type ToastFn = (title: string, options?: ToastOptions) => string;

const success: ToastFn = (title, options) =>
  addToast(title, "success", options);
const error: ToastFn = (title, options) => addToast(title, "error", options);
const info: ToastFn = (title, options) => addToast(title, "info", options);
const warning: ToastFn = (title, options) =>
  addToast(title, "warning", options);
const message: ToastFn = (title, options) =>
  addToast(title, undefined, options);

const toast = Object.assign(message, {
  success,
  error,
  info,
  warning,
  message,
});

export { toast };
export type { ToastOptions };
