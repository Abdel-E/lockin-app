import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // For GitHub Pages under https://<user>.github.io/lockin-app/
  // Vite will prefix all asset URLs with this base in production builds.
  base: '/lockin-app/',
  plugins: [react()],
  optimizeDeps: {
    include: ['react-markdown', 'remark-math', 'rehype-katex', 'katex'],
  },
});
