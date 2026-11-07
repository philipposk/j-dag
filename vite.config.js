import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { seoHtml } from './seo.config.mjs';
import vercel from './vercel.json' with { type: 'json' };
// Preview uses the same headers as production so CSP regressions show up locally.
const headers = Object.fromEntries(vercel.headers[0].headers.map(h => [h.key, h.value]));
export default defineConfig({
  preview: { headers },
  build: { rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), da: resolve(import.meta.dirname, 'da/index.html') } } },
  plugins: [{ name: 'static-seo', transformIndexHtml(html) {
    const lang = /<html lang="da"/.test(html) ? 'da' : 'en';
    const { head, body } = seoHtml(lang);
    return html.replace('<!--seo-head-->', head).replace('<!--seo-body-->', body);
  } }],
});
