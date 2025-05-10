import NotificationBell from "@/components/notification/notification-bell";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Filter, Plus, Search, SortAsc } from "lucide-react";
import { useState } from "react";

export function Header() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState("all");

  if (!user) return null;

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800">
      {/* Top row with search, actions and user info */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <input
              type="text"
              placeholder="Search..."
              className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-zinc-700 dark:text-zinc-300"
          >
            <Plus className="h-4 w-4" />
            <span>New Task</span>
          </Button>

          <NotificationBell />

          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {user.name?.charAt(0) || user.email.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Bottom row with filters */}
      <div className="flex items-center px-4 py-1 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
        <div className="flex items-center gap-1 mr-4">
          {["all", "active", "backlog", "completed"].map((filter) => (
            <Button
              key={filter}
              variant={activeFilter === filter ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "px-3 py-1 text-xs capitalize",
                activeFilter === filter
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400",
              )}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-zinc-600 dark:text-zinc-400"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filter</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-zinc-600 dark:text-zinc-400"
          >
            <SortAsc className="h-3.5 w-3.5" />
            <span>Sort</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
