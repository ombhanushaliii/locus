/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' forces sample data; '0' forces the API. Default: API in dev, sample data in production builds. */
  readonly VITE_MOCK?: string;
  /** '1' draws the SVG paper map instead of vector tiles. */
  readonly VITE_PAPER?: string;
}
