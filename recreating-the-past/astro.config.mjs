// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://recreatingthepast.netlify.app',
  // Emit /about.html (served at /about) instead of /about/index.html (served at
  // /about/ behind a 301). Keeps the served URL, the canonical tag, the sitemap,
  // and internal links all on the same redirect-free, no-trailing-slash form.
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [react()]
});