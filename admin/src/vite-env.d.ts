/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public site origin, used only for "View site" links. */
  readonly VITE_CLIENT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
