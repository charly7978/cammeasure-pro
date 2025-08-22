import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    format: 'es',
    plugins: () => [
      // Add any worker-specific plugins here if needed
    ],
  },
  build: {
    rollupOptions: {
      external: [
        '@tensorflow/tfjs',
        '@tensorflow/tfjs-backend-webgl',
        '@tensorflow/tfjs-backend-cpu',
        '@tensorflow-models/coco-ssd',
        '@mediapipe/tasks-vision',
        'ml-matrix'
      ],
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'measurementWorker.js') {
            return 'assets/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        globals: {
          '@tensorflow/tfjs': 'tf',
          '@tensorflow/tfjs-backend-webgl': 'tf',
          '@tensorflow/tfjs-backend-cpu': 'tf',
          '@tensorflow-models/coco-ssd': 'cocoSsd',
          '@mediapipe/tasks-vision': 'mediapipe',
          'ml-matrix': 'mlMatrix'
        }
      },
    },
  },
}));
