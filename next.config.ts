import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // There is an unrelated package-lock.json in the user profile directory, and
  // Turbopack otherwise guesses that as the workspace root. Pin it here.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
