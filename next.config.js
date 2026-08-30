/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit and its font-handling dependencies read files from disk at
  // runtime using paths relative to their own package folder. Letting
  // webpack bundle them (the Next.js default) breaks those relative
  // paths and crashes PDF generation with a 500 error. Marking them as
  // external packages leaves them as plain Node `require`s instead.
  experimental: {
    serverComponentsExternalPackages: [
      "pdfkit",
      "fontkit",
      "linebreak",
      "unicode-properties",
      "brotli",
    ],
  },
};

module.exports = nextConfig;
