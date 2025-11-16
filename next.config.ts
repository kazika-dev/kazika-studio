import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // サーバーコンポーネントでのみ使用される外部パッケージ
  serverExternalPackages: [
    '@google-cloud/storage',
    'google-auth-library',
    'pg',
    'pg-pool',
  ],

  // Turbopack 設定（空の設定でデフォルトを使用）
  turbopack: {},

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // クライアントサイドでは Node.js モジュールを外部化
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'child_process': false,
        'fs': false,
        'net': false,
        'tls': false,
        'dns': false,
      };
    }
    return config;
  },
};

export default nextConfig;
