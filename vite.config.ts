import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true },
  build: {
    target: 'es2020',
    // Rapier's compat build embeds its WebAssembly (~2 MB gzip); keep it and three in their own cacheable chunks.
    chunkSizeWarningLimit: 3500,
    rollupOptions: {
      output: { manualChunks: { three: ['three'], rapier: ['@dimforge/rapier3d-compat'] } }
    }
  }
});
