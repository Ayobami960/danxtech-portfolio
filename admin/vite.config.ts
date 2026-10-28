import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dev server keeps the browser same-origin with the API: `/api` and
// `/socket.io` are proxied to the local backend, and VITE_API_URL stays empty.
// The target must match `PORT` in backend/.env (8001 in local development).
const DEV_API_TARGET = "http://localhost:8001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: DEV_API_TARGET,
        changeOrigin: false,
      },
      "/socket.io": {
        target: DEV_API_TARGET,
        ws: true,
        changeOrigin: false,
      },
    },
  },
  build: {
    sourcemap: false,
  },
});
