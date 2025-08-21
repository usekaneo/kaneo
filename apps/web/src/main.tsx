import "@/index.css";
import queryClient from "@/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AuthProvider from "./components/providers/auth-provider";
import { ThemeProvider } from "./components/providers/theme-provider";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { ErrorFallback } from "./components/ui/error-fallback";
import { KeyboardShortcutsProvider } from "./hooks/use-keyboard-shortcuts";
import { routeTree } from "./routeTree.gen";
import { trpc } from "./utils/trpc";

console.log(`
██╗  ██╗ █████╗ ███╗   ██╗███████╗ ██████╗ 
██║ ██╔╝██╔══██╗████╗  ██║██╔════╝██╔═══██╗
█████╔╝ ███████║██╔██╗ ██║█████╗  ██║   ██║
██╔═██╗ ██╔══██║██║╚██╗██║██╔══╝  ██║   ██║
██║  ██╗██║  ██║██║ ╚████║███████╗╚██████╔╝
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝ ╚═════╝ 
`);

const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
  defaultPreload: "intent",
  context: { trpc, queryClient },
  defaultPendingComponent: () => <div>Loading...</div>,
  defaultNotFoundComponent: () => <div>Not Found</div>,
  Wrap: ({ children }) => (
    <ErrorBoundary fallback={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <KeyboardShortcutsProvider>{children}</KeyboardShortcutsProvider>
          </AuthProvider>
        </ThemeProvider>
        {children}
      </QueryClientProvider>
    </ErrorBoundary>
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root") as HTMLElement;
if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
