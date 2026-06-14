import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    browser: 'src/browser.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  platform: 'node',
  target: 'es2022',
  deps: {
    alwaysBundle: ['@ngtaxkit/core'],
    neverBundle: ['pdfkit'],
    dts: {
      alwaysBundle: ['@ngtaxkit/core'],
      neverBundle: ['pdfkit'],
    },
  },
});
