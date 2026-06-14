import path from "path";
import {defineConfig, loadEnv} from "vite";
import { VitePWA } from "vite-plugin-pwa";
import mkcert from "vite-plugin-mkcert";

const env = loadEnv('production', process.cwd(), '')

const useHttps = ["1", "true", "yes", "on"]
    .includes((env.USE_HTTPS ?? "")
        .trim().toLowerCase());
const serverPort = env.SERVER_PORT?.trim() || "3001";
const devServerOrigin = env.VITE_DEV_SERVER_ORIGIN?.trim()
  || `${useHttps ? "https" : "http"}://127.0.0.1:${serverPort}`;

export default defineConfig({
  plugins: [
    ...(useHttps && (!env.CODESPACES || env.CODESPACES === "false") ? [mkcert()] : []),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "items/**/*.png"],
      manifest: {
        id: "voxicraft",
        name: "Voxicraft",
        short_name: "Voxicraft",
        description: "Voxicraft, un jeu de construction voxel conçu pour être nativement cross-platforms.",
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
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
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
  server: {
    proxy: {
      "/ws": {
        target: devServerOrigin,
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      "/api": {
        target: devServerOrigin,
        changeOrigin: true,
        secure: false,
      },
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
