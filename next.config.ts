import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Enables forbidden()/unauthorized() interrupts used by the DAL.
  experimental: {
    authInterrupts: true,
  },
  // Hosts allowed to load dev/HMR resources (e.g. accessing the dev server
  // over the LAN). Dev-only; ignored in production.
  allowedDevOrigins: ["172.30.1.1"],
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
