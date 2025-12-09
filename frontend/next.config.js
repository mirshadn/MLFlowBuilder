/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  experimental: {
    turbopack: {
      // Set the Turbopack root to the frontend directory to silence
      // "inferred workspace root" warnings when multiple lockfiles exist.
      root: path.resolve(__dirname),
    },
  },
}

module.exports = nextConfig
