import queryClient from '@/query-client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import AuthProvider from './components/providers/auth-provider';
import useAuth from './components/providers/auth-provider/hooks/use-auth';
import { ThemeProvider } from './components/providers/theme-provider';
import { routeTree } from './routeTree.gen';

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  context: {
    user: null,
    queryClient,
  },
});

declare module '@tanstack/react-router' {
  type Register = {
    router: typeof router;
  };
}

const App = () => {
  const { user } = useAuth();

  return (
    <RouterProvider
      context={{ user }}
      router={router}
    />
  );
};

const rootElement = document.querySelector('#root')!;
if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}
