import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` writes ONE self-contained dist/index.html (all JS + CSS inlined),
// so the built game still opens with a double-click, no server needed.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2022' },
});
