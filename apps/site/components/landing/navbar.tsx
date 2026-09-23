"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/landing/logo";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetClose,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { landing } from "@/lib/landing";

type LinkItem = {
  href: string;
  label: string;
};

type NavigationLink =
  | {
      href: string;
      label: string;
      submenu?: false;
    }
  | {
      label: string;
      submenu: true;
      items: LinkItem[];
    };

const navigationLinks: NavigationLink[] = [
  { href: "/#features", label: landing.navigation.product },
  { href: "/pricing", label: landing.navigation.pricing },
  { href: "/blog", label: landing.navigation.blog },
  {
    label: landing.navigation.resources,
    submenu: true,
    items: [
      { href: "/docs/core", label: landing.navigation.docs },
      { href: "/guides", label: landing.navigation.guides },
      { href: "/alternatives", label: landing.navigation.comparisons },
      {
        href: "https://cloud.kaneo.app/public-project/vlu4ak2w8rs9rn1r4lirj2u1",
        label: landing.navigation.roadmap,
      },
    ],
  },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 px-4 backdrop-blur-md md:px-6">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-6">
            <a
              className="flex h-8 items-center text-primary hover:text-primary"
              href="/"
              aria-label={landing.navigation.home}
            >
              <Logo />
            </a>
            <NavigationMenu
              className="max-md:hidden"
              viewport={false}
              delayDuration={0}
              skipDelayDuration={0}
            >
              <NavigationMenuList className="gap-2">
                {navigationLinks.map((link) => (
                  <NavigationMenuItem key={link.label}>
                    {link.submenu ? (
                      <>
                        <NavigationMenuTrigger className="rounded-none *:[svg]:-me-0.5 bg-transparent px-2 py-1.5 font-medium text-muted-foreground hover:text-primary *:[svg]:size-3.5">
                          {link.label}
                        </NavigationMenuTrigger>
                        <NavigationMenuContent className="data-[motion=from-end]:slide-in-from-right-16! data-[motion=from-start]:slide-in-from-left-16! data-[motion=to-end]:slide-out-to-right-16! data-[motion=to-start]:slide-out-to-left-16! z-50 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                          <ul className="min-w-48">
                            {link.items.map((item) => (
                              <li key={item.label}>
                                <NavigationMenuLink
                                  className="rounded-none py-1.5"
                                  href={item.href}
                                >
                                  {item.label}
                                </NavigationMenuLink>
                              </li>
                            ))}
                          </ul>
                        </NavigationMenuContent>
                      </>
                    ) : (
                      <NavigationMenuLink
                        className="rounded-none bg-transparent px-2 py-1.5 font-medium text-muted-foreground hover:bg-transparent hover:text-primary focus:bg-transparent"
                        href={link.href}
                      >
                        {link.label}
                      </NavigationMenuLink>
                    )}
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="hidden text-sm md:inline-flex"
            size="sm"
            variant="ghost"
            onClick={() => {
              window.location.href = "https://cloud.kaneo.app/auth/sign-in";
            }}
          >
            {landing.navigation.signIn}
          </Button>
          <Button
            className="text-sm"
            size="sm"
            onClick={() => {
              window.location.href = "https://cloud.kaneo.app";
            }}
          >
            {landing.navigation.getStarted}
          </Button>
          <MobileNavigation />
        </div>
      </div>
    </header>
  );
}

function MobileNavigation() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={landing.navigation.menu}
        render={
          <Button className="size-11 md:hidden" size="icon" variant="ghost" />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetPopup
        side="top"
        showCloseButton={false}
        className="max-h-dvh overflow-y-auto bg-background pb-[env(safe-area-inset-bottom)] motion-reduce:transition-none"
      >
        <SheetTitle className="sr-only">{landing.navigation.menu}</SheetTitle>
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <a
            href="/"
            aria-label={landing.navigation.home}
            onClick={() => setOpen(false)}
          >
            <Logo />
          </a>
          <SheetClose
            aria-label={landing.navigation.closeMenu}
            render={<Button className="size-11" size="icon" variant="ghost" />}
          >
            <X className="size-5" />
          </SheetClose>
        </div>
        <nav aria-label={landing.navigation.menu} className="px-6 py-4">
          {navigationLinks.map((link) =>
            link.submenu ? (
              <div key={link.label} className="mt-4 border-t pt-5">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {link.label}
                </p>
                <ul className="grid grid-cols-2 gap-x-4">
                  {link.items.map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex min-h-12 items-center rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex min-h-14 items-center justify-between rounded-md text-2xl font-medium tracking-tight hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
              >
                {link.label}
                <ArrowUpRight className="size-5 text-muted-foreground" />
              </a>
            ),
          )}
        </nav>
        <div className="grid grid-cols-2 gap-3 border-t px-6 py-5">
          <Button
            className="h-11"
            variant="outline"
            render={<a href="https://cloud.kaneo.app/auth/sign-in" />}
          >
            {landing.navigation.signIn}
          </Button>
          <Button
            className="h-11"
            render={<a href="https://cloud.kaneo.app/auth/sign-up" />}
          >
            {landing.navigation.getStarted}
          </Button>
        </div>
      </SheetPopup>
    </Sheet>
  );
}
