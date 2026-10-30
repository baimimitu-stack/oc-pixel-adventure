import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    // 努努工作台在 public/ 下，dev 时不走模块图、不热更新，浏览器一缓存就是「改了没变化」。
    // 这里给这些静态资源强制 no-store，刷新必拉新。
    name: 'nunu-no-store',
    configureServer(server) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url && req.url.includes('/games/nunu-studio/')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
        next();
      });
    },
  }],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
