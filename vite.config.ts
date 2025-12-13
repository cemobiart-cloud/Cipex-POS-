import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'نظام نقاط البيع (POS)',
        short_name: 'POS',
        description: 'تطبيق إدارة مبيعات متكامل',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'https://drive.google.com/file/d/1Pt8CJ8RNUPzi4tPb2qdu3XaNqv8R8AhG/view?usp=sharing',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://drive.google.com/file/d/1LQeEuD2wF9sr7krx7tKf8k3bQQ6bIgK8/view?usp=sharing',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  base: './',
});