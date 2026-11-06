import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const POS_ASSETS_DIR = 'D:\\tigshop\\前端页面\\5.8.60\\o2o_admin\\admin\\assets';

function posPreviewPlugin(): Plugin {
  return {
    name: 'pos-preview-static',
    configureServer(server) {
      if (!fs.existsSync(POS_ASSETS_DIR)) return;
      const files = fs.readdirSync(POS_ASSETS_DIR);
      const entry = files
        .filter((file) => /^index-.*\.js$/.test(file))
        .sort(
          (a, b) =>
            fs.statSync(path.join(POS_ASSETS_DIR, b)).size -
            fs.statSync(path.join(POS_ASSETS_DIR, a)).size,
        )[0];
      const cssFiles = files
        .filter((file) => /^index-.*\.css$/.test(file))
        .sort(
          (a, b) =>
            fs.statSync(path.join(POS_ASSETS_DIR, b)).size -
            fs.statSync(path.join(POS_ASSETS_DIR, a)).size,
        )
        .slice(0, 2);
      if (!entry) return;

      const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <base href="/admin/pos/" />
  <title>收银台</title>
  ${cssFiles.map((file) => `<link rel="stylesheet" href="/admin/pos/assets/${file}" />`).join('\n  ')}
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/admin/pos/assets/${entry}"></script>
</body>
</html>`;

      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url || '/';
        const pathname = decodeURIComponent(rawUrl.split('?')[0]);
        const referer = req.headers.referer || '';
        const isPosRedirect =
          (pathname === '/admin/login/index' && rawUrl.includes('redirect=/pos')) ||
          (pathname.startsWith('/admin/assets/') && (referer.includes('/admin/pos') || referer.includes('redirect=/pos')));
        if (!pathname.startsWith('/admin/pos') && !isPosRedirect) return next();

        if (pathname.startsWith('/admin/pos/assets/') || pathname.startsWith('/admin/assets/')) {
          const relative = pathname.startsWith('/admin/pos/assets/')
            ? pathname.slice('/admin/pos/assets/'.length)
            : pathname.slice('/admin/assets/'.length);
          let filePath = path.join(POS_ASSETS_DIR, relative);
          if (!fs.existsSync(filePath) && relative.startsWith('assets/')) {
            filePath = path.join(POS_ASSETS_DIR, relative.slice('assets/'.length));
          }
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const types: Record<string, string> = {
              '.js': 'text/javascript',
              '.css': 'text/css',
              '.json': 'application/json',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.webp': 'image/webp',
              '.svg': 'image/svg+xml',
              '.woff': 'font/woff',
              '.woff2': 'font/woff2',
              '.ttf': 'font/ttf',
            };
            res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
            res.end(fs.readFileSync(filePath));
            return;
          }
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), posPreviewPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-semi': ['@douyinfe/semi-ui', '@douyinfe/semi-icons', '@douyinfe/semi-foundation'],
          'vendor-react': ['react', 'react-dom'],
          'vendor-editor': ['@wangeditor/editor', '@wangeditor/editor-for-react'],
          'vendor-charts': ['echarts'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@semi-css': path.resolve(__dirname, 'node_modules/@douyinfe/semi-ui/dist/css/semi.min.css'),
    },
  },
  server: {
    port: 3002,
    proxy: {
      '/adminapi': {
        target: 'https://battery.recy.cc',
        changeOrigin: true,
        secure: false,
      },
      '/static': {
        target: 'https://battery.recy.cc',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
