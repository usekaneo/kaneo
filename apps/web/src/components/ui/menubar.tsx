"use client";

import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar";

import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuPortal,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/cn";

function Menubar({ className, ...props }: MenubarPrimitive.Props) {
  return (
    <MenubarPrimitive
      className={cn(
        "flex items-center gap-1 rounded-lg border bg-background p-1",
        className,
      )}
      data-slot="menubar"
      {...props}
    />
  );
}

const MenubarMenu = Menu;
const MenubarGroup = MenuGroup;
const MenubarPortal = MenuPortal;
const MenubarRadioGroup = MenuRadioGroup;
const MenubarSub = MenuSub;
const MenubarTrigger = MenuTrigger;
const MenubarSubTrigger = MenuSubTrigger;
const MenubarSubContent = MenuSubPopup;
const MenubarContent = MenuPopup;
const MenubarItem = MenuItem;
const MenubarCheckboxItem = MenuCheckboxItem;
const MenubarRadioItem = MenuRadioItem;
const MenubarLabel = MenuGroupLabel;
const MenubarSeparator = MenuSeparator;
const MenubarShortcut = MenuShortcut;

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
};
