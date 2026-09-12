import "./instrument";

import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import queryClient from "@/query-client";
import "@/index.css";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { KeyboardShortcutsHelp } from "./components/keyboard-shortcuts-help";
import AuthProvider from "./components/providers/auth-provider";
import { ThemeProvider } from "./components/providers/theme-provider";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { KeyboardShortcutsProvider } from "./hooks/use-keyboard-shortcuts";
import { captureCheckoutIntent } from "./lib/checkout-intent";
import { AppI18nProvider } from "./lib/i18n/provider";
import { routeTree } from "./routeTree.gen";

// Capture a pricing-page `?checkout=<plan>-<interval>` deep link before the
// router runs and strips it across the sign-up → onboarding redirect chain.
captureCheckoutIntent();

console.log(`
                     ////////  
              /////  ////////  
            //////// ////////  
  //////// ///////// ///////   
  //////// ///////// //////    
  //////// ///////// ////      
  //////// ///////// ///       
  //////// ///////// /////     
  //////// ///////// //////    
  //////// ///////// ////////  
  //////// ///////// ////////  
  //////// ///////// ////////  
  //////// ////////            
  ////////  /////              
  ///////                      
                   
  
  All you need. Nothing you don't.
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

function App() {
  const { user } = useAuth();

  return <RouterProvider router={router} context={{ user }} />;
}

// Root boundary fallback: shows a generic message and a refresh button,
// without rendering the raw error.message. The full error is still
// captured to Sentry by the boundary itself.
function RootCrashFallback({
  resetError,
}: {
  error: Error;
  resetError: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("common:error.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("common:error.description")}
        </p>
        <button
          type="button"
          onClick={resetError}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("common:error.refreshPage")}
        </button>
      </div>
    </div>
  );
}

const rootElement = document.getElementById("root") as HTMLElement;
if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary fallback={RootCrashFallback}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <AppI18nProvider>
                <KeyboardShortcutsProvider>
                  <App />
                  <KeyboardShortcutsHelp />
                </KeyboardShortcutsProvider>
              </AppI18nProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
