// Source - https://stackoverflow.com/a
// Posted by Fred Yankowski
// Retrieved 2025-12-08, License - CC BY-SA 4.0

import { defineConfig } from "vite";
import react from '@vitejs/plugin-react' // Make sure this is imported
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
   plugins: [
    react(),
    tailwindcss(), // 2. Add it to the plugins list
  ],
});
