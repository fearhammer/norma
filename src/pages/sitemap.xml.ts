import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const paths = Object.keys(import.meta.glob('./**/*.astro'))
    .filter(path => !path.includes('[') && path !== './404.astro')
    .map(path => path.replace(/^\.\//, '').replace(/(?:^|\/)index\.astro$/, '/').replace(/\.astro$/, '/'))
    .map(path => new URL(path.replace(/^\//, ''), site).href);
  const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.sort().map(url => `<url><loc>${escapeXml(url)}</loc></url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
