import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    // Allow serving large assets (GLB model is 114 MB)
    fs: { strict: false },
  },
  assetsInclude: ['**/*.glb'],
  build: {
    // Raise the chunk size warning threshold — GLB is served from public/, not bundled
    chunkSizeWarningLimit: 2000,
  },
})
