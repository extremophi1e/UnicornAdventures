import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  build: { target: "es2020" },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["atlas/**", "audio/**"],
      manifest: {
        name: "Zoe's Rainbow Unicorn",
        short_name: "Zoe Unicorn",
        description: "A rainbow unicorn game for Zoe",
        theme_color: "#ff8fcf",
        background_color: "#8ec5ff",
        display: "standalone",
        orientation: "portrait",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
