import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

// The dev server keeps the browser same-origin with the API: `/api` and
// `/socket.io` are proxied to the local backend, and VITE_API_URL stays empty.
// The target must match `PORT` in backend/.env (8001 in local development).
const DEV_API_TARGET = "http://localhost:8001";
const DEV_SERVER_PORT = 5173;

const normalizeHttpOrigin = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.pathname !== "/" && url.pathname !== "") return null;
    if (url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
};

/**
 * One policy, derived from the same VITE_API_URL that `src/utils/config.ts`
 * uses for `API_BASE`, so the fetch target and `connect-src` cannot drift.
 * An empty VITE_API_URL means same-origin (dev proxy or host rewrite), so
 * `'self'` alone is correct. WebSockets get the ws/wss scheme of that origin.
 */
const buildCsp = (apiOrigin: string | null, isDevServer: boolean): string => {
  const connect = new Set<string>(["'self'"]);

  if (apiOrigin) {
    const { protocol, host, origin } = new URL(apiOrigin);
    connect.add(origin);
    connect.add(`${protocol === "https:" ? "wss:" : "ws:"}//${host}`);
  }

  // Same-origin WebSockets on the Vite dev server; some browsers do not treat
  // ws:// as covered by 'self'.
  if (isDevServer) connect.add(`ws://localhost:${DEV_SERVER_PORT}`);

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${[...connect].join(" ")}`,
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
};

/**
 * Vercel cannot interpolate environment variables into `vercel.json` headers,
 * so the policy is baked into index.html at build time instead. Browsers
 * enforce a `<meta>` CSP exactly like a header for these directives.
 * `frame-ancestors` is ignored in a meta tag (and would log a console warning),
 * which is fine: `X-Frame-Options: DENY` in vercel.json blocks framing.
 */
const cspPlugin = (apiOrigin: string | null, isDevServer: boolean): Plugin => ({
  name: "admin-csp",
  transformIndexHtml: {
    order: "pre",
    handler: () => [
      {
        tag: "meta",
        attrs: {
          "http-equiv": "Content-Security-Policy",
          content: buildCsp(apiOrigin, isDevServer),
        },
        injectTo: "head-prepend",
      },
    ],
  },
});

export default defineConfig(({ command, mode }) => {
  // Prefix "" also picks up Vercel's build-time environment variables.
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const rawApiUrl = (fileEnv.VITE_API_URL ?? process.env.VITE_API_URL ?? "").trim();
  const apiOrigin = rawApiUrl === "" ? null : normalizeHttpOrigin(rawApiUrl);

  if (rawApiUrl !== "" && apiOrigin === null) {
    // Fail the build rather than ship a CSP that blocks every API call.
    throw new Error(
      `VITE_API_URL must be an absolute http(s) origin (no path), received "${rawApiUrl}".`,
    );
  }

  if (command === "build") {
    console.info(
      apiOrigin
        ? `[admin-csp] connect-src includes ${apiOrigin}`
        : "[admin-csp] VITE_API_URL is empty: API calls are same-origin ('self')",
    );
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      cspPlugin(apiOrigin, command === "serve"),
    ],
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
  };
});
