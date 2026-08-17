import { defineConfig } from 'astro/config';

export default defineConfig({
  publicDir: './assets',
  compressHTML: true,
  outDir: './dist',
  srcDir: './src',
  site: 'https://candura.studio',
  base: '/',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    routing: { prefixDefaultLocale: false },
  },
  build: {
    assets: 'assets',
  },
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  },
});
