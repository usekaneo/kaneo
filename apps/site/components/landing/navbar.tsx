"use client";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type LinkItem = {
  href: string;
  label: string;
  description?: string;
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
      type: "description" | "simple";
      items: LinkItem[];
    };

const navigationLinks: NavigationLink[] = [
  {
    items: [
      {
        description:
          "Understand the product model and day-to-day workflows end to end.",
        href: "/docs/core/functional",
        label: "Functional Guides",
      },
      {
        description:
          "Set up your workspace structure and initial project configuration.",
        href: "/docs/core/functional/create-workspace-and-project",
        label: "Create Workspace & Project",
      },
      {
        description:
          "Run tasks across board and list views with clear ownership and status.",
        href: "/docs/core/functional/plan-and-execute-tasks",
        label: "Plan & Execute Tasks",
      },
      {
        description:
          "Use backlog planning to organize upcoming work and sequencing.",
        href: "/docs/core/functional/backlog-planning",
        label: "Backlog Planning",
      },
      {
        description:
          "Define and evolve project workflows to match your delivery process.",
        href: "/docs/core/functional/configure-workflows",
        label: "Configure Workflows",
      },
    ],
    label: "Product",
    submenu: true,
    type: "description",
  },
  {
    items: [
      { href: "/docs/core", label: "Quick Start" },
      { href: "/docs/core/installation", label: "Installation" },
      { href: "/docs/core/functional", label: "Functional Guide" },
      { href: "/docs/api-reference/introduction", label: "API Reference" },
    ],
    label: "Docs",
    submenu: true,
    type: "simple",
  },
  {
    items: [
      { href: "#why", label: "Why Kaneo" },
      { href: "https://github.com/usekaneo/kaneo", label: "Open Source" },
      {
        href: "https://cloud.kaneo.app/public-project/vlu4ak2w8rs9rn1r4lirj2u1",
        label: "Roadmap",
      },
      {
        href: "https://github.com/usekaneo/kaneo/blob/main/CONTRIBUTING.md",
        label: "Contributing",
      },
    ],
    label: "About",
    submenu: true,
    type: "simple",
  },
  {
    items: [
      { href: "/blog", label: "Latest posts" },
      { href: "/blog/category/alternatives", label: "Alternatives" },
      { href: "/guides", label: "Guides" },
      { href: "/alternatives", label: "Compare tools" },
    ],
    label: "Blog",
    submenu: true,
    type: "simple",
  },
  { href: "/pricing", label: "Pricing" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 px-4 backdrop-blur-md md:px-6">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  className="group size-8 md:hidden"
                  size="icon"
                  variant="ghost"
                />
              }
            >
              <svg
                className="pointer-events-none"
                fill="none"
                height={16}
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width={16}
                xmlns="http://www.w3.org/2000/svg"
              >
                <title>Menu</title>
                <path
                  className="-translate-y-[7px] origin-center transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-x-0 group-aria-expanded:translate-y-0 group-aria-expanded:rotate-315"
                  d="M4 12L20 12"
                />
                <path
                  className="origin-center transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.8)] group-aria-expanded:rotate-45"
                  d="M4 12H20"
                />
                <path
                  className="origin-center translate-y-[7px] transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-y-0 group-aria-expanded:rotate-135"
                  d="M4 12H20"
                />
              </svg>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-1 md:hidden">
              <NavigationMenu className="max-w-none *:w-full" viewport={false}>
                <NavigationMenuList className="flex-col items-start gap-0 md:gap-2">
                  {navigationLinks.map((link) => (
                    <NavigationMenuItem className="w-full" key={link.label}>
                      {link.submenu ? (
                        <>
                          <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">
                            {link.label}
                          </div>
                          <ul>
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
                        </>
                      ) : (
                        <NavigationMenuLink
                          className="rounded-none py-1.5"
                          href={link.href}
                        >
                          {link.label}
                        </NavigationMenuLink>
                      )}
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-6">
            <a
              className="flex h-8 items-center text-primary hover:text-primary"
              href="/"
              aria-label="Kaneo home"
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
                          <ul
                            className={cn(
                              link.type === "description"
                                ? "min-w-64"
                                : "min-w-48",
                            )}
                          >
                            {link.items.map((item) => (
                              <li key={item.label}>
                                <NavigationMenuLink
                                  className="rounded-none py-1.5"
                                  href={item.href}
                                >
                                  {link.type === "description" &&
                                  "description" in item ? (
                                    <div className="space-y-1">
                                      <div className="font-medium">
                                        {item.label}
                                      </div>
                                      <p className="line-clamp-2 text-muted-foreground text-xs">
                                        {item.description}
                                      </p>
                                    </div>
                                  ) : (
                                    <span>{item.label}</span>
                                  )}
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
            className="text-sm max-sm:hidden"
            size="sm"
            variant="ghost"
            onClick={() => {
              window.location.href = "https://github.com/sponsors/andrejsshell";
            }}
          >
            Sponsor
          </Button>
          <Button
            className="text-sm"
            size="sm"
            variant="ghost"
            onClick={() => {
              window.location.href = "https://cloud.kaneo.app/auth/sign-in";
            }}
          >
            Sign In
          </Button>
          <Button
            className="text-sm"
            size="sm"
            onClick={() => {
              window.location.href = "https://cloud.kaneo.app";
            }}
          >
            Get Started
          </Button>
        </div>
      </div>
    </header>
  );
}
