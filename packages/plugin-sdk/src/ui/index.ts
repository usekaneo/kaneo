import { createElement } from "react";
import { getPluginHost } from "../web/host.js";
import type {
  BadgeProps,
  ButtonProps,
  InputProps,
  LabelProps,
  SeparatorProps,
  SkeletonProps,
  SpinnerProps,
  SwitchProps,
  TextareaProps,
} from "./types.js";

export function Button(props: ButtonProps) {
  return createElement(getPluginHost().ui.Button, props);
}

export function Badge(props: BadgeProps) {
  return createElement(getPluginHost().ui.Badge, props);
}

export function Input(props: InputProps) {
  return createElement(getPluginHost().ui.Input, props);
}

export function Textarea(props: TextareaProps) {
  return createElement(getPluginHost().ui.Textarea, props);
}

export function Label(props: LabelProps) {
  return createElement(getPluginHost().ui.Label, props);
}

export function Switch(props: SwitchProps) {
  return createElement(getPluginHost().ui.Switch, props);
}

export function Spinner(props: SpinnerProps) {
  return createElement(getPluginHost().ui.Spinner, props);
}

export function Skeleton(props: SkeletonProps) {
  return createElement(getPluginHost().ui.Skeleton, props);
}

export function Separator(props: SeparatorProps) {
  return createElement(getPluginHost().ui.Separator, props);
}

export function WeekStartControl() {
  return createElement(getPluginHost().ui.WeekStartControl);
}

export type * from "./types.js";
