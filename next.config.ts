import type { NextConfig } from "next";

const key = process.env.ANTHROPIC_API_KEY;
if (key) {
  console.log(`[agent-lab] ANTHROPIC_API_KEY: ${key.slice(0, 12)}...${key.slice(-4)}`);
} else {
  console.warn("[agent-lab] ANTHROPIC_API_KEY is NOT set");
}

const nextConfig: NextConfig = {};

export default nextConfig;
