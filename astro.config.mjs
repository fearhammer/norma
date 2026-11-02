import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://norma-studio.ru',
  base: process.env.DEPLOY_TARGET === 'regru' ? '/' : process.env.GITHUB_ACTIONS === 'true' ? '/norma' : undefined,
  output: 'static',
  trailingSlash: 'always',
});
