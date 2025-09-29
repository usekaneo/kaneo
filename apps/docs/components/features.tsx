import {
  Calendar,
  ChevronsUp,
  CircleDot,
  LayoutListIcon,
  PlusIcon,
  Server,
  ShieldIcon,
  Wand,
} from "lucide-react";

export default function Features() {
  return (
    <section className="bg-sidebar" id="features">
      <div className="@container py-24">
        <div className="mx-auto w-full max-w-6xl px-6 xl:px-0">
          <div className="relative">
            <div
              aria-hidden="true"
              className="mask-radial-from-15% before:bg-foreground/25 after:bg-foreground/25 absolute size-3 before:absolute before:inset-0 before:m-auto before:h-px after:absolute after:inset-0 after:m-auto after:w-px -translate-[calc(50%-0.5px)]"
            />
            <div
              aria-hidden="true"
              className="mask-radial-from-15% before:bg-foreground/25 after:bg-foreground/25 absolute size-3 before:absolute before:inset-0 before:m-auto before:h-px after:absolute after:inset-0 after:m-auto after:w-px right-0 -translate-y-[calc(50%-0.5px)] translate-x-[calc(50%-0.5px)]"
            />
            <div
              aria-hidden="true"
              className="mask-radial-from-15% before:bg-foreground/25 after:bg-foreground/25 absolute size-3 before:absolute before:inset-0 before:m-auto before:h-px after:absolute after:inset-0 after:m-auto after:w-px bottom-0 right-0 translate-x-[calc(50%-0.5px)] translate-y-[calc(50%-0.5px)]"
            />
            <div
              aria-hidden="true"
              className="mask-radial-from-15% before:bg-foreground/25 after:bg-foreground/25 absolute size-3 before:absolute before:inset-0 before:m-auto before:h-px after:absolute after:inset-0 after:m-auto after:w-px bottom-0 -translate-x-[calc(50%-0.5px)] translate-y-[calc(50%-0.5px)]"
            />

            <div className="relative grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 divide-x divide-y border overflow-hidden">
              {/* Left: 1:1 visual copy of a Column with TaskCards (static markup) */}
              <div className="xl:col-span-2 col-span-full xl:row-span-2 grid gap-8 p-8">
                <div className="max-w-84 mx-auto w-full self-center">
                  <div className="flex flex-col h-full w-full min-h-0 backdrop-blur-xs rounded-lg relative group transition-all duration-300 ease-out bg-sidebar border border-border/50 dark:bg-zinc-900/30 hover:bg-zinc-50/40 dark:hover:bg-zinc-900/40 hover:shadow-sm">
                    <div className="p-2 shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CircleDot className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                            In Progress
                          </h3>
                          <span className="text-sm text-zinc-500 dark:text-zinc-500">
                            1
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
                      <div className="flex flex-col gap-1.5 pr-2">
                        {/* Stacked look: background layers */}
                        <div className="relative overflow-visible">
                          <div className="absolute inset-0 translate-y-2 translate-x-2 rounded-lg bg-card border border-border opacity-60 pointer-events-none z-0" />
                          <div className="absolute inset-0 translate-y-1 translate-x-1 rounded-lg bg-card border border-border opacity-80 pointer-events-none z-0" />

                          {/* Single TaskCard clone */}
                          <div className="relative z-10 group bg-card border border-border rounded-lg p-3 transition-all duration-200 ease-out hover:border-border/70 hover:shadow-sm">
                            <div className="absolute top-3 right-3">
                              <div
                                className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center"
                                title="Unassigned"
                              >
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  ?
                                </span>
                              </div>
                            </div>
                            <div className="mb-3 pr-7">
                              <h3
                                className="font-medium text-foreground text-sm leading-relaxed overflow-hidden break-words"
                                style={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: "vertical",
                                  wordBreak: "break-word",
                                  hyphens: "auto",
                                }}
                              >
                                Design onboarding flow for new workspace members
                              </h3>
                            </div>
                            <div className="mb-3">
                              <div className="flex flex-wrap gap-1">
                                <span className="px-2 py-0.5 text-[10px] flex items-center rounded border border-border text-muted-foreground">
                                  <span
                                    className="inline-block w-1.5 h-1.5 mr-1 rounded-full"
                                    style={{ backgroundColor: "#78716c" }}
                                  />
                                  <span className="truncate max-w-[80px]">
                                    Onboarding
                                  </span>
                                </span>
                                <span className="px-2 py-0.5 text-[10px] flex items-center rounded border border-border text-muted-foreground">
                                  <span
                                    className="inline-block w-1.5 h-1.5 mr-1 rounded-full"
                                    style={{ backgroundColor: "#8b5cf6" }}
                                  />
                                  <span className="truncate max-w-[80px]">
                                    Design
                                  </span>
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-sidebar text-[10px] font-medium text-muted-foreground">
                                <ChevronsUp className="size-3" />
                              </span>
                              <div className="flex items-center gap-1 text-[10px] px-2 py-1 rounded text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/30">
                                <Calendar className="size-3" />
                                <span>Oct 12</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                {/* Bottom-left text cell (separate grid item) */}
                <div className="mx-auto max-w-sm text-center">
                  <h3 className="text-balance font-semibold">
                    Powerful task workflows
                  </h3>
                  <p className="text-muted-foreground mt-3">
                    Plan, prioritize, and ship with a fast Kanban board and an
                    efficient list view.
                  </p>
                </div>

                {/* Right: Feature list tailored to Kaneo */}
              </div>
              <div className="xl:col-span-2 relative col-span-full xl:row-span-2 grid gap-8 p-8">
                <div
                  aria-hidden="true"
                  className="mask-radial-from-15% before:bg-foreground/25 after:bg-foreground/25 absolute size-3 before:absolute before:inset-0 before:m-auto before:h-px after:absolute after:inset-0 after:m-auto after:w-px bottom-0 -translate-x-[calc(50%+0.5px)] translate-y-[calc(50%+0.5px)]"
                />

                <div className="@4xl:px-8 mx-auto max-w-sm self-center">
                  <div
                    aria-hidden="true"
                    className="bg-foreground/5 group rounded-2xl"
                  >
                    <div className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-medium">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-link size-3.5 opacity-50"
                      >
                        <title>Integrations</title>
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      Integrations
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 scale-100 opacity-100 blur-lg transition-all duration-300">
                        <div className="bg-linear-to-r/increasing animate-hue-rotate absolute inset-x-6 bottom-0 top-12 -translate-y-3 from-pink-400 to-purple-400" />
                      </div>
                      <div className="bg-card ring-foreground/10 relative overflow-hidden rounded-2xl border border-transparent px-6 py-3 shadow-md shadow-black/5 ring-1">
                        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-dashed py-3 last:border-b-0">
                          <div className="bg-muted border-foreground/5 flex size-12 items-center justify-center rounded-lg border">
                            <svg
                              width="1em"
                              height="1em"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <title>GitHub logo</title>
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
                            <p className="text-muted-foreground line-clamp-1 text-sm">
                              Link PRs to tasks and auto-close issues on merge.
                            </p>
                          </div>
                          <div className="cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow-sm shadow-black/15 border border-transparent bg-background ring-1 ring-foreground/10 duration-200 hover:bg-muted/50 dark:ring-foreground/15 dark:hover:bg-muted/50 h-9 w-9">
                            <PlusIcon className="size-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="relative z-10 mx-auto max-w-sm text-center">
                  <h3 className="text-balance font-semibold">
                    Native GitHub integration
                  </h3>
                  <p className="text-muted-foreground mt-3">
                    Connect repositories and sync issues and pull requests to
                    tasks with live status updates and smart linking.
                  </p>
                </div>
              </div>
              {/* Full-width features row under the headers */}
              <div className="col-span-full xl:col-span-4 -mt-px px-0 border-t border-border/60">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-0 divide-y md:divide-x divide-border/60 items-start [&>div]:px-4 [&>div]:py-4 md:[&>div]:px-6">
                  <div className="space-y-2">
                    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                      <LayoutListIcon className="size-4" />
                      <h3 className="text-sm font-medium leading-none">
                        Kanban and List views
                      </h3>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Switch between a blazing-fast board and a dense table view
                      with filters and saved views.
                    </p>
                  </div>

                  <div className="space-y-2 h-full">
                    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                      <ShieldIcon className="size-4" />
                      <h3 className="text-sm font-medium leading-none">
                        Privacy-first
                      </h3>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Minimal analytics, no tracking by default, and granular
                      access controls.
                    </p>
                  </div>

                  <div className="space-y-2 h-full">
                    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                      <Server className="size-4" />
                      <h3 className="text-sm font-medium leading-none">
                        Self-hosted
                      </h3>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      One-click Docker deploys, backups, and no vendor lock-in.
                    </p>
                  </div>

                  <div className="space-y-2 h-full">
                    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                      <Wand className="size-4" />
                      <h3 className="text-sm font-medium leading-none">
                        Labels, priorities, due dates
                      </h3>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Everything you need to plan work: tags, priorities, and
                      smart due date states.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
