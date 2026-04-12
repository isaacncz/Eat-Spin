import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/')) return 'react-vendor';
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('gsap') || id.includes('@gsap')) return 'gsap';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('date-fns') || id.includes('zod')) return 'utils';
            if (id.includes('@radix-ui')) return 'radix';
            if (id.includes('embla-carousel') || id.includes('sonner') || id.includes('react-hook-form')) return 'ui-vendor';
            if (id.includes('html-to-image')) return 'html-to-image';
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          }
        },
      },
    },
  },
});
