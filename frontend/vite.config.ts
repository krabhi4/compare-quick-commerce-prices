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
      manifest: {
        name: 'QuickCompare — live grocery prices by pincode',
        short_name: 'QuickCompare',
        description:
          'Live prices from Blinkit, Zepto, Instamart, Flipkart Minutes and BigBasket Now, side by side for one pincode.',
        theme_color: '#edf0ec',
        background_color: '#edf0ec',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
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
      '/location': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
