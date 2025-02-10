import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [TanStackRouterVite(), react()],
  server: {
    host: true,
  },
  resolve: {
    alias: {
      // eslint-disable-next-line unicorn/prefer-module
      '@': path.resolve(__dirname, './src'),
    },
  },
});
