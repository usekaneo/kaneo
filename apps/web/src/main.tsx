import queryClient from "@/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import AuthProvider from "./components/providers/auth-provider";
import { ThemeProvider } from "./components/providers/theme-provider";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { ErrorFallback } from "./components/ui/error-fallback";
import { KeyboardShortcutsProvider } from "./hooks/use-keyboard-shortcuts";
import { routeTree } from "./routeTree.gen";

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
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  context: {
    user: null,
    queryClient,
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  const { user } = useAuth();

  return <RouterProvider router={router} context={{ user }} />;
}

const rootElement = document.getElementById("root") as HTMLElement;
if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary fallback={ErrorFallback}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <KeyboardShortcutsProvider>
                <App />
              </KeyboardShortcutsProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
