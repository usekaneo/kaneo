import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Search } from "lucide-react";
import { useState } from "react";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/search",
)({
  component: SearchComponent,
});

function SearchComponent() {
  const { workspaceId } = Route.useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
    }, 1000);
  };

  return (
    <>
      <PageTitle title="Search" />
      <WorkspaceLayout
        title="Search"
        headerActions={
          <Link to="/dashboard/workspace/$workspaceId" params={{ workspaceId }}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        }
      >
        <div className="space-y-6">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search projects, tasks, comments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch(searchQuery);
                  }
                }}
                className="pl-10 h-12 text-lg"
                autoFocus
              />
              <Button
                onClick={() => handleSearch(searchQuery)}
                disabled={!searchQuery.trim() || isSearching}
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                size="sm"
              >
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Search across all projects, tasks, and comments in this workspace
            </p>
          </div>

          {searchQuery ? (
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Search Results for "{searchQuery}"
              </h2>

              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse mx-auto" />
                    <div className="space-y-2">
                      <div className="w-48 h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mx-auto" />
                      <div className="w-64 h-3 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mx-auto" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">No results found</p>
                  <p className="text-muted-foreground">
                    Try adjusting your search terms or search for something else
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Start Searching</h2>
              <p className="text-muted-foreground mb-6">
                Enter a search term to find projects, tasks, and comments
              </p>

              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Quick searches:
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "High priority",
                    "Bug",
                    "Feature",
                    "In progress",
                    "Completed",
                  ].map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery(suggestion);
                        handleSearch(suggestion);
                      }}
                      className="text-xs"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </WorkspaceLayout>
    </>
  );
}
