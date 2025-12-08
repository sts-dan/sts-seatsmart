// Source - https://stackoverflow.com/a
// Posted by Fred Yankowski
// Retrieved 2025-12-08, License - CC BY-SA 4.0

import { defineConfig } from "vite";
import postcssNesting from 'postcss-nesting';

export default defineConfig({
    css: {
        postcss: {
            plugins: [
                postcssNesting
            ],
        },
    },
});
