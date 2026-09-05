/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // The whole app used to ship as one 1.67 MB chunk — 76 route components plus
    // Recharts and Framer Motion all in the first paint. The split now comes
    // entirely from the `lazy()` route imports in router.tsx, which the bundler
    // follows to produce a chunk per route.
    //
    // Manual chunk grouping was tried here and removed: grouping recharts by
    // package name pulled shared utilities (clsx) into the same chunk, so the
    // entry ended up importing the 413 kB charting bundle on every page — the
    // exact problem the split was meant to solve. Automatic splitting respects
    // the dynamic-import boundaries correctly; leave it alone.
    chunkSizeWarningLimit: 700,
  },

  /*
   * The suite covers pure logic only — money arithmetic, security boundaries,
   * policy checks, escaping. No DOM, no component rendering, no mocked
   * Supabase.
   *
   * That is a deliberate scope rather than a first step towards mounting
   * everything: these are the functions where a silent regression has real
   * consequence, and every one of them is testable without a browser. The
   * regressions that actually hurt this project were of exactly this kind — a
   * shape change that zeroed every professional's earnings and reported no
   * error anywhere.
   */
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
