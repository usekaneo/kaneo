import type { ComponentPropsWithoutRef, ComponentType } from "react";

export type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "ghost"
    | "destructive"
    | "destructive-outline"
    | "link";
  size?:
    | "xs"
    | "sm"
    | "default"
    | "lg"
    | "xl"
    | "icon"
    | "icon-xs"
    | "icon-sm"
    | "icon-lg"
    | "icon-xl";
};

export type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "destructive"
    | "info"
    | "success"
    | "warning";
  size?: "sm" | "default" | "lg";
};

export type InputProps = ComponentPropsWithoutRef<"input">;

export type TextareaProps = ComponentPropsWithoutRef<"textarea">;

export type LabelProps = ComponentPropsWithoutRef<"label">;

export type SwitchProps = {
  id?: string;
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  "aria-label"?: string;
};

export type SpinnerProps = {
  className?: string;
};

export type SkeletonProps = ComponentPropsWithoutRef<"div">;

export type SeparatorProps = {
  className?: string;
  orientation?: "horizontal" | "vertical";
};

export type HostComponents = {
  Button: ComponentType<ButtonProps>;
  Badge: ComponentType<BadgeProps>;
  Input: ComponentType<InputProps>;
  Textarea: ComponentType<TextareaProps>;
  Label: ComponentType<LabelProps>;
  Switch: ComponentType<SwitchProps>;
  Spinner: ComponentType<SpinnerProps>;
  Skeleton: ComponentType<SkeletonProps>;
  Separator: ComponentType<SeparatorProps>;
};
