/** biome-ignore-all lint/a11y/noStaticElementInteractions: todo */
import { DotsThreeIcon, IconContext } from "@phosphor-icons/react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export type MenuItemProps = {
  destructiveAction?: boolean;
  href?: string;
  hrefExternal?: boolean;
  icon?: React.ReactNode;
  label?: string | React.ReactNode;
  checked?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  titleContent?: React.ReactNode;
  type: "button" | "link" | "divider" | "title" | "checkbox" | string;
};

export type DropdownMenuProps = {
  align: "center" | "end" | "start";
  alignOffset?: number;
  buttonProps?: React.ComponentProps<typeof buttonVariants>;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  MenuItems: Array<MenuItemProps> | null;
  onCloseRmFocus?: boolean;
  side: "bottom" | "left" | "right" | "top";
  sideOffset?: number;
  size?: "sm" | "base";
  id?: string;
};

const DropdownMenu = ({
  align,
  alignOffset,
  buttonProps,
  children,
  className,
  disabled,
  MenuItems,
  onCloseRmFocus = true,
  side,
  sideOffset,
  id,
  size = "base"
}: DropdownMenuProps) => (
  <DropdownMenuPrimitive.Root>
    <DropdownMenuPrimitive.Trigger
      id={id}
      className={cn(
        children
          ? "radix-state-open:!text-neutral-950 dark:radix-state-open:!text-white text-neutral-500 focus-visible:opacity-100 dark:text-neutral-400"
          : buttonVariants(
              buttonProps ?? {
                variant: "ghost",
                size: "default", // 'base',
                // shape: 'square',
                // interaction: 'none',
                class:
                  "radix-state-open:text-neutral-950 dark:radix-state-open:text-white focus-visible:opacity-100"
              }
            ),
        className
      )}
      disabled={disabled}
    >
      {children ?? <DotsThreeIcon weight="bold" />}
    </DropdownMenuPrimitive.Trigger>
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align ?? "start"}
        sideOffset={sideOffset ?? 0}
        alignOffset={alignOffset ?? 0}
        side={side ?? "bottom"}
        onCloseAutoFocus={(e) => {
          onCloseRmFocus ? e.preventDefault() : null;
        }}
        className={cn(
          "z-modal radix-state-closed:animate-scaleFadeOutSm radix-state-open:animate-scaleFadeInSm overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 py-1.5 text-base font-medium text-neutral-900 shadow-lg shadow-black/5 transition-transform duration-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white",
          {
            "origin-top-right": align === "end" && side === "bottom",
            "origin-top-left": align === "start" && side === "bottom",
            "origin-bottom-right": align === "end" && side === "top",
            "origin-bottom-left": align === "start" && side === "top",
            "text-sm font-normal": size === "sm"
          }
        )}
      >
        {MenuItems?.map((item, index) => {
          if (item.type === "title") {
            return (
              <header
                className="px-2.5 py-2.5 dark:border-neutral-800"
                onClick={(e) => e.preventDefault()}
                onKeyDown={(e) => e.preventDefault()}
                // biome-ignore lint/suspicious/noArrayIndexKey: TODO
                key={index}
              >
                {item.titleContent}
              </header>
            );
          } else if (item.type === "divider") {
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: TODO
              <div className="my-1.5 w-full px-2.5" key={index}>
                <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800" />
              </div>
            );
          } else if (item.type === "link" || item.type === "button") {
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: TODO
              <DropdownMenuPrimitive.Item asChild key={index}>
                {item.type === "link" ? (
                  <a
                    className="radix-highlighted:bg-neutral-100 radix-highlighted:text-neutral-950 dark:radix-highlighted:bg-neutral-800 dark:radix-highlighted:text-white flex w-full items-center justify-between gap-5 rounded-md p-2.5 text-neutral-700 focus:outline-none dark:text-neutral-300"
                    href={item.href || ""}
                    target={item.hrefExternal ? "_blank" : undefined}
                  >
                    {item.label}
                    <IconContext.Provider
                      value={{
                        size: size === "sm" ? 16 : 20
                      }}
                    >
                      {item.icon}
                    </IconContext.Provider>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={cn(
                      "radix-highlighted:bg-neutral-100 radix-highlighted:text-neutral-950 dark:radix-highlighted:bg-neutral-800 dark:radix-highlighted:text-white flex w-full items-center justify-between gap-5 rounded-md p-2.5 text-neutral-700 focus:outline-none dark:text-neutral-300",
                      {
                        "radix-highlighted:bg-red-50 radix-highlighted:text-red-600 dark:radix-highlighted:bg-red-500/10 dark:radix-highlighted:text-red-400 text-red-500 dark:text-red-400/90":
                          item.destructiveAction
                      }
                    )}
                  >
                    {item.label}
                    <IconContext.Provider
                      value={{
                        size: size === "sm" ? 16 : 20
                      }}
                    >
                      {item.icon}
                    </IconContext.Provider>
                  </button>
                )}
              </DropdownMenuPrimitive.Item>
            );
          }
          return null;
        })}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  </DropdownMenuPrimitive.Root>
);

DropdownMenu.displayName = "DropdownMenu";

export { DropdownMenu };
