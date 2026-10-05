/** @file Configuración de Next.js para imports NodeNext, cabeceras de seguridad y caché de tipografías versionadas. */
import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  /** Resuelve imports .js de NodeNext a fuentes TypeScript sin reescribir el cliente independiente. */
  webpack(config) {
    // Preserve the framework-independent NodeNext client's .js import specifiers.
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"], ".mjs": [".mts", ".mjs"] };
    return config;
  },
  /** Aplica protección de contenido/ubicación y permite caché inmutable sólo a assets tipográficos versionados. */
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }, { source: "/map-fonts/5.3.0/:path*", headers: [
      { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
    ] }];
  },
};
export default config;
