import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/comfy": {
        target: process.env.VITE_COMFY_PROXY_TARGET || "http://127.0.0.1:8188",
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/comfy/, ""),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("three")) return "three";
            if (id.includes("@tauri-apps")) return "tauri-vendor";
            if (id.includes("react")) return "react-vendor";
            return "vendor";
          }
          if (id.includes("/src/lazy-panels.jsx")) return "workspace-panels";
          if (id.includes("/src/management-panels.jsx")) return "management-panels";
          if (id.includes("/src/heavy-nodes.jsx")) return "heavy-nodes";
          if (id.includes("/src/canvas-heavy-nodes.jsx")) return "canvas-heavy-nodes";
          if (id.includes("/src/basic-nodes.jsx")) return "basic-nodes";
          if (id.includes("/src/utility-panels.jsx")) return "utility-panels";
          if (id.includes("/src/minimap-panel.jsx")) return "minimap-panel";
        },
      },
    },
  },
});
