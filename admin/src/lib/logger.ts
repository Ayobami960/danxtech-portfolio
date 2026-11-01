/**
 * Development-only diagnostics.
 *
 * Production builds also drop `console`/`debugger` via esbuild (vite.config.ts),
 * so a stray console call can never print a URL, token or payload to a real
 * user's console. Nothing here should ever receive secrets.
 */
const enabled = import.meta.env.DEV;

const noop = (..._args: unknown[]): void => undefined;

export const logger = {
  error: enabled
    ? (...args: unknown[]): void => console.error(...args)
    : noop,
  warn: enabled ? (...args: unknown[]): void => console.warn(...args) : noop,
  info: enabled ? (...args: unknown[]): void => console.info(...args) : noop,
  debug: enabled ? (...args: unknown[]): void => console.debug(...args) : noop,
};
