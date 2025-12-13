import {
  Calendar,
  ChevronsUp,
  CircleDot,
  GitBranch,
  LayoutListIcon,
  PlusIcon,
  Server,
  ShieldIcon,
  Wand,
} from "lucide-react";
import Link from "next/link";

export default function Features() {
  return (
    <section className="relative bg-sidebar" id="features">
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/30 to-transparent"
      />

      <div className="@container border-t border-foreground/10 border-dashed">
        <div className="mx-auto max-w-6xl px-2 lg:px-6">
          <div className="border-x border-foreground/10 border-dashed px-2 lg:px-2">
            <div className="relative border-x border-foreground/10 border-dashed">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-x divide-y divide-foreground/10 divide-dashed overflow-hidden *:p-4 md:*:p-6 xl:*:p-8">
                <div className="xl:col-span-2 col-span-full xl:row-span-2 grid gap-8">
                  <div className="mx-auto w-full max-w-md self-center">
                    <div className="flex flex-col h-full w-full min-h-0 backdrop-blur-xs rounded-lg relative group transition-all duration-300 ease-out bg-card/50 border border-border/50 hover:bg-card/70 hover:shadow-md">
                      <div className="p-3 shrink-0">
                        <div className="flex items-center gap-2">
                          <CircleDot className="w-4 h-4 text-muted-foreground" />
                          <h3 className="font-medium text-foreground">
                            In Progress
                          </h3>
                          <span className="text-sm text-muted-foreground">
                            1
                          </span>
                        </div>
                      </div>

                      <div className="p-3 pt-0 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
                        <div className="flex flex-col gap-2">
                          <div className="relative overflow-visible">
                            <div className="absolute inset-0 translate-y-2 translate-x-2 rounded-lg bg-card border border-border/40 opacity-60 pointer-events-none" />
                            <div className="absolute inset-0 translate-y-1 translate-x-1 rounded-lg bg-card border border-border/40 opacity-80 pointer-events-none" />

                            <div className="relative bg-card border border-border rounded-lg p-3 transition-all duration-200 ease-out hover:border-primary/30 hover:shadow-sm">
                              <div className="mb-3">
                                <h4 className="font-medium text-foreground text-sm leading-relaxed">
                                  Design onboarding flow for new workspace
                                  members
                                </h4>
                              </div>
                              <div className="mb-3">
                                <div className="flex flex-wrap gap-1">
                                  <span className="px-2 py-0.5 text-[10px] flex items-center rounded border border-border text-muted-foreground">
                                    <span className="inline-block w-1.5 h-1.5 mr-1 rounded-full bg-stone-500" />
                                    <span className="truncate">Onboarding</span>
                                  </span>
                                  <span className="px-2 py-0.5 text-[10px] flex items-center rounded border border-border text-muted-foreground">
                                    <span className="inline-block w-1.5 h-1.5 mr-1 rounded-full bg-violet-500" />
                                    <span className="truncate">Design</span>
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-sidebar text-[10px] font-medium text-muted-foreground">
                                  <ChevronsUp className="size-3 text-orange-400/70" />
                                </span>
                                <div className="flex items-center gap-1 text-[10px] px-2 py-1 rounded text-muted-foreground bg-muted/50">
                                  <Calendar className="size-3" />
                                  <span>Oct 12</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mx-auto max-w-sm text-center">
                    <h3 className="text-balance font-semibold text-lg">
                      Powerful task workflows
                    </h3>
                    <p className="text-muted-foreground mt-3">
                      Plan, prioritize, and ship with a fast Kanban board and an
                      efficient list view.
                    </p>
                  </div>
                </div>

                <div className="xl:col-span-2 col-span-full xl:row-span-2 grid gap-8 xl:border-r-0">
                  <div className="mx-auto max-w-sm w-full self-center">
                    <div className="bg-foreground/5 rounded-2xl overflow-hidden">
                      <div className="flex items-center gap-1.5 px-6 py-3 text-sm font-medium">
                        <GitBranch className="size-3.5 opacity-50" />
                        Integrations
                      </div>
                      <div className="relative">
                        <div className="absolute inset-0 opacity-100 blur-lg">
                          <div className="absolute inset-x-6 bottom-0 top-12 bg-gradient-to-r from-violet-400/30 to-purple-400/30" />
                        </div>
                        <div className="bg-card ring-foreground/10 relative overflow-hidden rounded-2xl border border-transparent px-6 py-4 shadow-lg ring-1">
                          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-dashed border-border/60 pb-3">
                            <div className="bg-muted border-foreground/5 flex size-12 items-center justify-center rounded-lg border">
                              <svg
                                width="1em"
                                height="1em"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                                className="size-6"
                                aria-label="GitHub"
                              >
                                <title>GitHub</title>
                                <path
                                  fill="currentColor"
                                  d="M12 1.5c-5.8 0-10.5 4.7-10.5 10.5 0 4.6 3 8.5 7.2 9.9.5.1.7-.2.7-.5v-1.8c-2.9.6-3.6-1.2-3.6-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.5 1.1 3.1.8.1-.7.4-1.1.7-1.4-2.3-.3-4.6-1.1-4.6-5 0-1.1.4-1.9 1-2.6-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1 .8-.2 1.7-.3 2.6-.3.9 0 1.8.1 2.6.3 1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.6 1 2.6 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5 4.2-1.4 7.2-5.3 7.2-9.9C22.5 6.2 17.8 1.5 12 1.5z"
                                />
                              </svg>
                            </div>
                            <div className="space-y-0.5">
                              <h3 className="text-sm font-medium">
                                GitHub Pull Requests
                              </h3>
                              <p className="text-muted-foreground  text-xs">
                                Import issues from GitHub and sync them to
                                Kaneo.
                              </p>
                            </div>
                            <Link href="/docs/core/integrations/github/setup">
                              <div className="cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-transparent bg-background ring-1 ring-foreground/10 hover:bg-muted/50 h-9 w-9">
                                <PlusIcon className="size-4" />
                              </div>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="relative z-10 mx-auto max-w-sm text-center">
                    <h3 className="text-balance font-semibold text-lg">
                      Native GitHub integration
                    </h3>
                    <p className="text-muted-foreground mt-3">
                      Connect repositories and sync issues.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 xl:border-b-0">
                  <div className="flex items-center gap-2">
                    <LayoutListIcon className="size-4 text-primary" />
                    <h3 className="text-sm font-medium">Kanban & List views</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Switch between board and table with filters and saved views.
                  </p>
                </div>

                <div className="space-y-2 xl:border-b-0">
                  <div className="flex items-center gap-2">
                    <ShieldIcon className="size-4 text-primary" />
                    <h3 className="text-sm font-medium">Privacy-first</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Minimal analytics, no tracking, granular access controls.
                  </p>
                </div>

                <div className="space-y-2 border-b-0">
                  <div className="flex items-center gap-2">
                    <Server className="size-4 text-primary" />
                    <h3 className="text-sm font-medium">Self-hosted</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    One-click Docker deploys, backups, no vendor lock-in.
                  </p>
                </div>

                <div className="space-y-2 border-b-0 xl:border-r-0">
                  <div className="flex items-center gap-2">
                    <Wand className="size-4 text-primary" />
                    <h3 className="text-sm font-medium">Labels & priorities</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Everything you need: tags, priorities, due dates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
