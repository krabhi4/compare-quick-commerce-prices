import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'QuickCompare - Quick-Commerce Price Comparison',
        short_name: 'QuickCompare',
        description: 'Real-time price comparison across Blinkit, Zepto, Instamart & more',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/search': 'http://localhost:8000',
      '/history': 'http://localhost:8000',
      '/alerts': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
      '/location': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
