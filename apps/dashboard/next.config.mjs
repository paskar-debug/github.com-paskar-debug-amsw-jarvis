/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@amsw/db"],
  webpack(config) {
    // @amsw/db is consumed as raw TS source (ESM-style ".js" specifiers
    // pointing at ".ts" files); tell webpack to resolve them the same way
    // tsc's NodeNext moduleResolution does.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
