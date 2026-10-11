import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// The exact build, shown small in Settings next to the version number.
const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7)

// Publishes the version history as /releases.json, so a phone running an
// older version can read what the new one changes. (It isn't part of the
// offline copy, so it's always fetched fresh.)
const releasesFile = {
  name: 'releases-json',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'releases.json', source: readFileSync('src/releases.json', 'utf8') })
  },
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_COMMIT__: JSON.stringify(commit),
  },
  plugins: [
    releasesFile,
    react(),
    VitePWA({
      // The app asks before switching to a new version (UpdateBanner), so an
      // update never reloads the page in the middle of cooking.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Our Kitchen',
        short_name: 'Our Kitchen',
        description: 'A shared recipe app for two people who cook together.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Include the PDF reader's worker (.mjs) so PDFs can be read offline.
        globPatterns: ['**/*.{js,mjs,css,html,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // OCR engine and English language data, fetched the first time
            // the phone reads a screenshot itself; kept for offline use.
            urlPattern: /^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com|tessdata\.projectnaptha\.com)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
