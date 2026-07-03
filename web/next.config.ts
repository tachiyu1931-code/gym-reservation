// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

function readNetworkConfig() {
  const defaultConfig = {
    scheme: "http",
    raspiHost: "192.168.3.248",
    raspiPort: 5000,
  };

  const configPath = path.resolve(process.cwd(), "..", "network-config.json");
  if (!fs.existsSync(configPath)) {
    return defaultConfig;
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return defaultConfig;
  }
}

const networkConfig = readNetworkConfig();

const nextConfig: NextConfig = {
  // production modeはtrue
  productionBrowserSourceMaps: true,
  env: {
    NEXT_PUBLIC_RASPI_BASE_URL: `${networkConfig.scheme || "http"}://${networkConfig.raspiHost}:${networkConfig.raspiPort}`,
    NEXT_PUBLIC_RASPI_HOST: networkConfig.raspiHost,
    NEXT_PUBLIC_RASPI_PORT: String(networkConfig.raspiPort),
  },
};

export default nextConfig;
