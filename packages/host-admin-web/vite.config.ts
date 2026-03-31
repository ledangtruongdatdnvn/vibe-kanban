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
              sources: [path.resolve(__dirname, 'src')],
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
    ],
  },
  server: {
    port: 3006,
    fs: {
      allow: [path.resolve(__dirname, '.'), path.resolve(__dirname, '../..')],
    },
  },
  build: {
    sourcemap: true,
  },
});
