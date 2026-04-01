import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import pkg from './package.json';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
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
        find: '@host-admin',
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
