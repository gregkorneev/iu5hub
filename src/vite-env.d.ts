interface ImportMetaEnv {
  readonly VITE_ANALYTICS_API_BASE?: string
  readonly VITE_APP_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
