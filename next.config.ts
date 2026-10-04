import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  webpack(config) {
    // Preserve the framework-independent NodeNext client's .js import specifiers.
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"], ".mjs": [".mts", ".mjs"] };
    return config;
  },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};
export default config;
