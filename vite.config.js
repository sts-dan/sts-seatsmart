// Source - https://stackoverflow.com/a
// Posted by Fred Yankowski
// Retrieved 2025-12-08, License - CC BY-SA 4.0

import { defineConfig } from "vite";
import react from '@vitejs/plugin-react' // Make sure this is imported
import postcssNesting from 'postcss-nesting';

export default defineConfig({
    plugins: [react()],
    css: {
        postcss: {
            plugins: [
                postcssNesting
            ],
        },
    },
});
