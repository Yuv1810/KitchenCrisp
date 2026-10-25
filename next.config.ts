import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  experimental: {
    agentUpgrade: "security",
  } as any,
};
export default config;
