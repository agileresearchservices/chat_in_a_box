import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/ollama/:path*',
        destination: 'http://localhost:11434/api/chat',
      },
    ]
  },
  reactStrictMode: true,
};

export default nextConfig;
