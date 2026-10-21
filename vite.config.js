import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      '^/(?!__)[A-Za-z0-9_-]{3,40}$': 'http://127.0.0.1:8080',
    },
  },
  build: {
    outDir: 'static',
    emptyOutDir: true,
    rollupOptions: {output: {
      entryFileNames: 'app.js',
      chunkFileNames: 'assets/[name]-[hash].js',
      manualChunks(id) {
        if (id.includes('node_modules') && /recharts|d3-|victory-vendor|react-smooth/.test(id)) return 'charts';
      },
      assetFileNames: info => info.names?.some(name => name.endsWith('.css')) ? 'style.css' : 'assets/[name]-[hash][extname]',
    }},
  },
});
