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
})
