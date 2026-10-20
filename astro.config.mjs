import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://norma-studio.ru',
  base: process.env.GITHUB_ACTIONS === 'true' ? '/norma' : undefined,
  output: 'static',
  trailingSlash: 'always',
});
