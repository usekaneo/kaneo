import { useEffect } from 'react';
import useTheme from './hooks/use-theme';

export const ThemeProvider = ({
  children,
}: {
  readonly children: React.ReactNode;
}) => {
  const { theme } = useTheme();

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  return children;
};
