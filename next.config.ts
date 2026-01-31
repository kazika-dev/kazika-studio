import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // サーバーコンポーネントでのみ使用される外部パッケージ
  serverExternalPackages: [
    '@google-cloud/storage',
    'google-auth-library',
    'pg',
    'pg-pool',
    '@ai-sdk/anthropic',
  ],
 async headers() {
      return [
        {
          source: '/api/:path*',
          headers: [
            { key: 'Access-Control-Allow-Origin', value: '*' },
            { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
            { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          ],
        },
      ];
    },
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
