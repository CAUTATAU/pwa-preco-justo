import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Gera os ícones PNG do PWA a partir de public/icon.svg: npm run icons
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0.1, resizeOptions: { background: '#0f8a5a' } },
    apple: { ...preset.apple, padding: 0.1, resizeOptions: { background: '#0f8a5a' } },
  },
  images: ['public/icon.svg'],
})
