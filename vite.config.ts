import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function ogMetadataPlugin(): Plugin {
  return {
    name: 'og-metadata-plugin',
    configureServer(server) {
      server.middlewares.use('/api/og', async (req, res) => {
        try {
          const host = req.headers.host || 'localhost:3000';
          const urlObj = new URL(req.url || '', `http://${host}`);
          const targetUrl = urlObj.searchParams.get('url');

          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4500);

          const response = await fetch(targetUrl, {
            signal: controller.signal,
            redirect: 'follow',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept':
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
            },
          });
          clearTimeout(timeout);

          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ url: targetUrl }));
            return;
          }

          const html = await response.text();

          // Extract OG / Twitter / link tags
          const ogImageMatch =
            html.match(/<meta\s+[^>]*property=["']og:image(?::url)?["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image(?::url)?["']/i) ||
            html.match(/<meta\s+[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);

          const ogTitleMatch =
            html.match(/<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i) ||
            html.match(/<meta\s+[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<title[^>]*>([^<]+)<\/title>/i);

          const ogDescMatch =
            html.match(/<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i) ||
            html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);

          const ogSiteMatch =
            html.match(/<meta\s+[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);

          const faviconMatch =
            html.match(/<link\s+[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i) ||
            html.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i) ||
            html.match(/<link\s+[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i);

          const resolveUrl = (rel: string | undefined) => {
            if (!rel) return undefined;
            try {
              return new URL(rel, targetUrl).href;
            } catch {
              return rel;
            }
          };

          const result = {
            url: targetUrl,
            imageUrl: resolveUrl(ogImageMatch ? ogImageMatch[1] : undefined),
            title: ogTitleMatch ? ogTitleMatch[1].trim() : undefined,
            description: ogDescMatch ? ogDescMatch[1].trim() : undefined,
            siteName: ogSiteMatch ? ogSiteMatch[1].trim() : undefined,
            faviconUrl: resolveUrl(faviconMatch ? faviconMatch[1] : undefined),
          };

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Fetch failed' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), ogMetadataPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
