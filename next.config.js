/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/chat',
        destination: 'http://localhost:11434/api/chat',
      },
    ]
  }
}

module.exports = nextConfig
