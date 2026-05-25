import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const VENDOR_CHUNK_PATTERNS = [
  [/[\\/]three[\\/]/, "three"],
  [/[\\/]@tauri-apps[\\/]/, "tauri-vendor"],
  [/[\\/]react[\\/]/, "react-vendor"],
];

const SOURCE_CHUNK_PATTERNS = [
  [/[\\/]src[\\/]panels[\\/]project-dashboard-panel\.jsx$/, "panel-dashboard"],
  [/[\\/]src[\\/]panels[\\/]export-center-panel\.jsx$/, "panel-export-center"],
  [/[\\/]src[\\/]panels[\\/]timeline-panel\.jsx$/, "panel-timeline"],
  [/[\\/]src[\\/]panels[\\/]simple-workflow-panel\.jsx$/, "panel-simple-workflow"],
  [/[\\/]src[\\/]panels[\\/]generation-queue-panel\.jsx$/, "panel-generation-queue"],
  [/[\\/]src[\\/]panels[\\/](project-health|production-hub|archive-center)-panel\.jsx$/, "panel-ops"],
  [/[\\/]src[\\/]management-panels\.jsx$/, "management-panels"],
  [/[\\/]src[\\/]utility-panels\.jsx$/, "utility-panels"],
  [/[\\/]src[\\/]app[\\/]novel-factory-config\.js$/, "novel-factory-config"],
  [/[\\/]src[\\/]novel-factory-default-templates\.js$/, "novel-factory-templates"],
];

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(process.env.npm_package_version || "0.1.0"),
    "import.meta.env.VITE_APP_CHANNEL": JSON.stringify(process.env.VITE_APP_CHANNEL || "正式版"),
  },
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
            for (const [pattern, name] of VENDOR_CHUNK_PATTERNS) {
              if (pattern.test(id)) return name;
            }
            return "vendor";
          }
          for (const [pattern, name] of SOURCE_CHUNK_PATTERNS) {
            if (pattern.test(id)) return name;
          }
          return undefined;
        },
      },
    },
  },
});
