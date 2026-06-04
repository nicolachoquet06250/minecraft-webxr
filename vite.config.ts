import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "items/**/*.png"],
      manifest: {
        name: "Minecraft WebXR",
        short_name: "Minecraft XR",
        description: "Minecraft-like TypeScript Babylon.js WebXR game",
        start_url: "/",
        scope: "/",
        display: "fullscreen",
        display_override: ["fullscreen", "standalone"],
        orientation: "landscape",
        background_color: "#8cbfff",
        theme_color: "#8cbfff",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "/favicon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm,svg,png,webp,ico}"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 7000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@babylonjs/core")) {
              return "babylon";
            }
            if (id.includes("@babylonjs/gui")) {
              return "babylon-gui";
            }
            if (id.includes("@babylonjs/loaders")) {
              return "babylon-loaders";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
