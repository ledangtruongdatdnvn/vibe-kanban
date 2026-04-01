import path from 'path';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import pkg from './package.json';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/app/entry/routeTree.gen.ts',
    }),
    react({
      babel: {
        plugins: [
          [
            'babel-plugin-react-compiler',
            {
              target: '18',
              sources: [
                path.resolve(__dirname, 'src'),
                path.resolve(__dirname, '../web-core/src'),
              ],
              environment: {
                enableResetCacheOnSourceFileChanges: true,
              },
            },
          ],
        ],
      },
    }),
  ],
  resolve: {
    alias: [
      {
        find: '@admin',
        replacement: path.resolve(__dirname, 'src'),
      },
      {
        find: /^@\//,
        replacement: `${path.resolve(__dirname, '../web-core/src')}/`,
      },
      {
        find: 'shared',
        replacement: path.resolve(__dirname, '../../shared'),
      },
    ],
  },
  server: {
    port: 3006,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.HOST_ADMIN_PORT || '3005'}`,
        changeOrigin: true,
        ws: true,
      },
    },
    fs: {
      allow: [path.resolve(__dirname, '.'), path.resolve(__dirname, '../..')],
    },
  },
  build: {
    sourcemap: true,
  },
});
