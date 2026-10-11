import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Our Kitchen',
        short_name: 'Our Kitchen',
        description: 'A shared recipe app for two people who cook together.',
        theme_color: '#7a2e1f',
        background_color: '#fbf7f2',
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
