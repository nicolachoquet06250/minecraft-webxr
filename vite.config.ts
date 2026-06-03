import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 7000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@babylonjs/core')) {
              return 'babylon';
            }
            if (id.includes('@babylonjs/gui')) {
              return 'babylon-gui';
            }
            if (id.includes('@babylonjs/loaders')) {
              return 'babylon-loaders';
            }
            return 'vendor';
          }
        },
      },
    },
  },
})
