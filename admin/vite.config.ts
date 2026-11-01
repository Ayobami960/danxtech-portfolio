import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type UserConfig } from "vite";

// Dev keeps the browser same-origin with the API: `/api` and `/socket.io` are
// proxied here, so the app only ever calls relative paths and the session
// cookie stays first-party. Must match `PORT` in backend/.env (8001 locally).
const DEV_API_TARGET = "http://localhost:8001";
const DEV_SERVER_PORT = 5173;

/**
 * `connect-src 'self'` is enough because every API call is relative. Only the
 * dev server's own WebSocket origin is added, and only while serving.
 */
const buildCsp = (isDevServer: boolean): string => {
  const connect = ["'self'"];
  if (isDevServer) connect.push(`ws://localhost:${DEV_SERVER_PORT}`);

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connect.join(" ")}`,
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
};

/**
 * Vercel cannot interpolate env vars into `vercel.json` headers, so the policy
 * is baked into index.html at build time. No environment is read here: the app
 * no longer has an absolute API origin, so the policy is identical everywhere
 * except the dev WebSocket origin. `frame-ancestors` is ignored in a meta tag
 * and is covered by `X-Frame-Options: DENY` in vercel.json.
 */
const cspPlugin = (isDevServer: boolean): Plugin => ({
  name: "admin-csp",
  transformIndexHtml: {
    order: "pre",
    handler: () => [
      {
        tag: "meta",
        attrs: {
          "http-equiv": "Content-Security-Policy",
          content: buildCsp(isDevServer),
        },
        injectTo: "head-prepend",
      },
    ],
  },
});

export default defineConfig(({ command }) => {
  const isDevServer = command === "serve";

  const config: UserConfig = {
    plugins: [react(), tailwindcss(), cspPlugin(isDevServer)],
    server: {
      port: DEV_SERVER_PORT,
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
    /**
     * Production console stays silent. Vite 8 bundles with Oxc/Rolldown and has
     * no esbuild `drop`, so the console methods are replaced statically at build
     * time instead (the dev-only logger is already a no-op, this also covers
     * third-party code such as socket.io-client).
     */
    define: isDevServer
      ? {}
      : {
          "console.log": "(() => undefined)",
          "console.debug": "(() => undefined)",
          "console.info": "(() => undefined)",
          "console.warn": "(() => undefined)",
          "console.error": "(() => undefined)",
        },
  };

  return config;
});
