import { defineConfig } from 'astro/config';

export default defineConfig({
  publicDir: './public',
  compressHTML: true,
  outDir: './dist',
  srcDir: './src',
  site: 'https://candura.studio',
  base: '/',
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
