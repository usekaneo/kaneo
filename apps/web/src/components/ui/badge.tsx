import { cn } from "@/lib/cn";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      },
      badgeColor: {
        default: "",
        red: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800/30",
        blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800/30",
        green:
          "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800/30",
        yellow:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/30",
        purple:
          "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200 dark:border-purple-800/30",
        pink: "bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400 border-pink-200 dark:border-pink-800/30",
        indigo:
          "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/30",
        orange:
          "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200 dark:border-orange-800/30",
        gray: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700/30",
        "dark-gray":
          "bg-gray-200 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300 border-gray-300 dark:border-gray-600/30",
        teal: "bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-400 border-teal-200 dark:border-teal-800/30",
      },
    },
    defaultVariants: {
      variant: "default",
      badgeColor: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  badgeColor?:
    | "default"
    | "red"
    | "blue"
    | "green"
    | "yellow"
    | "purple"
    | "pink"
    | "indigo"
    | "orange"
    | "gray"
    | "dark-gray"
    | "teal";
}

function Badge({ className, variant, badgeColor, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, badgeColor }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
