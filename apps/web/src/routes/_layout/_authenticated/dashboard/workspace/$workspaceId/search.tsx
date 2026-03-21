import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useGlobalSearch from "@/hooks/queries/search/use-global-search";
import { getPriorityIcon } from "@/lib/priority";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/search",
)({
  component: SearchComponent,
});

function SearchComponent() {
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isFetching } = useGlobalSearch({
    q: debouncedQuery,
    workspaceId,
    type: "tasks",
  });

  const handleInputChange = useCallback((value: string) => {
    setSearchInput(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const results = data?.results ?? [];
  const hasQuery = debouncedQuery.length > 0;
  const showLoading = hasQuery && (isLoading || isFetching);

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
                placeholder="Search tasks by title or short ID (e.g. DEP-23)..."
                value={searchInput}
                onChange={(e) => handleInputChange(e.target.value)}
                className="pl-10 h-12 text-lg"
                autoFocus
              />
              {showLoading && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Search across all projects in this workspace. Use short IDs like
              DEP-23 to find specific tasks.
            </p>
          </div>

          {hasQuery ? (
            <div>
              {showLoading && results.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      Searching...
                    </p>
                  </div>
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground mb-3">
                    {data?.totalCount ?? results.length} result
                    {(data?.totalCount ?? results.length) !== 1 ? "s" : ""}{" "}
                    found
                  </p>
                  {results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => {
                        if (result.type === "task" && result.projectId) {
                          navigate({
                            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
                            params: {
                              workspaceId,
                              projectId: result.projectId,
                            },
                            search: { taskId: result.id },
                          });
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-background hover:bg-accent/60 transition-colors text-left"
                    >
                      <div className="flex-shrink-0 first:[&_svg]:h-4 first:[&_svg]:w-4">
                        {getPriorityIcon(result.priority ?? "")}
                      </div>

                      {result.projectSlug && result.taskNumber && (
                        <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                          {result.projectSlug}-{result.taskNumber}
                        </span>
                      )}

                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-foreground truncate block">
                          {result.title}
                        </span>
                      </div>

                      {result.projectName && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {result.projectName}
                        </span>
                      )}

                      {result.status && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-border bg-muted/55 text-muted-foreground flex-shrink-0">
                          {result.status}
                        </span>
                      )}
                    </button>
                  ))}
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
                Enter a search term to find tasks across all projects
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
                        setSearchInput(suggestion);
                        setDebouncedQuery(suggestion);
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
