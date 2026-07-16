import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'WSS — Inspecciones Técnicas',
        short_name: 'WSS',
        description: 'Sistema de gestión de calidad e inspección técnica WSS',
        theme_color: '#1E3A5F',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'es-CL',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        categories: ['business', 'productivity'],
      },
      workbox: {
        // Cachear todos los assets estáticos de la app
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // No usar navigate fallback para no interferir con rutas de Supabase
        navigateFallback: null,
        // Cacheo inteligente de llamadas a Supabase
        runtimeCaching: [
          {
            // API de Supabase: NetworkFirst — intenta red, usa cache si falla
            urlPattern: /^https:\/\/labxvesmcfbrdtftkwtg\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 24 * 60 * 60, // 24 horas
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Assets de Google Fonts: CacheFirst
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
