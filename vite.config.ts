import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import mkcert from "vite-plugin-mkcert";

export default defineConfig({
  plugins: [
    mkcert(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "items/**/*.png"],
      manifest: {
        id: "minecraft-webxr",
        name: "Minecraft WebXR",
        short_name: "Minecraft XR",
        description: "Un clone de Minecraft concu pour être nativement cross-platforms.",
        start_url: "/",
        scope: "/",
        display: "fullscreen",
        display_override: ["fullscreen", "standalone"],
        orientation: "landscape",
        background_color: "#8cbfff",
        theme_color: "#8cbfff",
        icons: [
          {
            src: "/favicon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/favicon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        screenshots: [
          {
            src: "/screenshots/screenshot-desktop.png",
            sizes: "2879x1799",
            type: "image/png",
            "label": "Écran sur desktop"
          },
          {
            src: "/screenshots/screenshot-mobile.png",
            sizes: "1024x500",
            type: "image/png",
            "label": "Écran sur mobile"
          },
        ],
        categories: ["games", "entertainment", "building"],
        prefer_related_applications: false,
        dir: "ltr"
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
