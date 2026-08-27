/// <reference types="vite/client" />

/** Stamped by `define` in `vite.config.ts`, not by a `.env` file. */
interface ImportMetaEnv {
  readonly VITE_BUILD_TIME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
