import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5174,
    open: false,
    host: true
  },
  build: {
    target: 'esnext'
  }
});
