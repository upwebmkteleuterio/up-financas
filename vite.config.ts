import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa"; // Importando o plugin PWA

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    dyadComponentTagger(), 
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Registra o service worker automaticamente
      injectRegister: 'auto',
      workbox: {
        // Cache de ativos estáticos
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Garante que a navegação funcione offline
        navigateFallback: '/index.html',
      },
      manifest: {
        name: 'Up Finanças',
        short_name: 'Up Finanças',
        description: 'Gestão estratégica de finanças e vendas.',
        theme_color: '#121a21', // Cor da sidebar/tema escuro
        background_color: '#202932', // Cor de fundo
        display: 'standalone', // Permite que o app pareça nativo
        icons: [
          {
            src: 'up-financas.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'up-financas.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable', // Ícone adaptável
          },
          {
            src: 'up-financas.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));