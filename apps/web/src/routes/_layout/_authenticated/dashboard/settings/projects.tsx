import { createFileRoute } from "@tanstack/react-router";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects",
)({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <PageTitle title="Project Settings" />
      <div>Hello "/_layout/_authenticated/dashboard/settings/projects"!</div>
    </>
  );
}
