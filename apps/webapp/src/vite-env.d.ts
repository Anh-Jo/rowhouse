/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API origin — see .env.example (defaults to http://localhost:3000). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
