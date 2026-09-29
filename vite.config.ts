import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev` serves the page only; /api is proxied to `wrangler dev` (port 8787) when it is running.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: { input: { main: 'index.html', admin: 'admin.html', std: 'std.html' } },
  },
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
});
