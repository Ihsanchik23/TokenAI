import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lcknkmwqdbidykfwngok.supabase.co",
        pathname: "/storage/v1/object/public/avatars/**",
      },
      {
        protocol: "https",
        hostname: "lcknkmwqdbidykfwngok.supabase.co",
        pathname: "/storage/v1/object/public/course-covers/**",
      },
    ],
  },
};

export default nextConfig;
