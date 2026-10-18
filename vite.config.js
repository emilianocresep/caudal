import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  resolve: { alias: { react: 'preact/compat', 'react-dom': 'preact/compat' } },
  build: { target: 'es2020', cssCodeSplit: true, chunkSizeWarningLimit: 400 },
  server: { proxy: { '/api': 'http://127.0.0.1:8788' } },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Cloudflare Access protege el sitio: el manifiesto debe pedirse con la cookie de sesión.
      useCredentials: true,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Caudal',
        short_name: 'Caudal',
        description: 'Tus finanzas personales: cuentas, movimientos, presupuestos y análisis.',
        lang: 'es-MX',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#07070b',
        theme_color: '#07070b',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [{ name: 'Nuevo movimiento', short_name: 'Nuevo', url: '/?nuevo=1', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/cdn-cgi\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
