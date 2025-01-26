/** @type {import('next').NextConfig} */
const nextConfig = {
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

module.exports = nextConfig;
