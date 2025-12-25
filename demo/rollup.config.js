/**
 * Rollup configuration for demo build
 * Bundles and minifies the demo application
 */

import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import copy from 'rollup-plugin-copy';

const production = !process.env.ROLLUP_WATCH;

export default {
    input: 'js/app.js',
    output: [
        {
            file: 'dist/demo.js',
            format: 'es',
            sourcemap: true
        },
        {
            file: 'dist/demo.min.js',
            format: 'es',
            sourcemap: true,
            plugins: [
                terser({
                    compress: {
                        drop_console: production,
                        drop_debugger: production,
                        pure_funcs: production ? ['console.log', 'console.debug'] : []
                    },
                    mangle: {
                        reserved: ['Calendar', 'Event', 'EventStore']
                    },
                    format: {
                        comments: false
                    }
                })
            ]
        }
    ],
    plugins: [
        // Resolve node modules
        nodeResolve({
            browser: true,
            preferBuiltins: false
        }),

        // Replace environment variables
        replace({
            preventAssignment: true,
            values: {
                '__BUILD_VERSION__': JSON.stringify(process.env.npm_package_version || 'development'),
                '__BUILD_DATE__': JSON.stringify(new Date().toISOString()),
                '__DEV__': !production
            }
        }),

        // Copy static assets
        copy({
            targets: [
                {
                    src: 'css/*.css',
                    dest: 'dist/css',
                    transform: (contents) => {
                        if (production) {
                            // Minify CSS
                            return contents
                                .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
                                .replace(/\s+/g, ' ') // Collapse whitespace
                                .replace(/:\s+/g, ':') // Remove spaces after colons
                                .replace(/;\s+/g, ';') // Remove spaces after semicolons
                                .trim();
                        }
                        return contents;
                    }
                },
                {
                    src: 'index-optimized.html',
                    dest: 'dist',
                    rename: 'index.html',
                    transform: (contents) => {
                        if (production) {
                            // Update paths for production
                            return contents
                                .replace(/js\/app\.js/g, 'demo.min.js')
                                .replace(/css\//g, 'dist/css/')
                                .replace(/<!--dev-->/g, '<!--')
                                .replace(/<!--\/dev-->/g, '-->');
                        }
                        return contents;
                    }
                }
            ]
        })
    ],
    external: [
        // Keep calendar-core external since it's already built
        /^\.\.\/dist\/calendar-core/
    ],
    watch: {
        clearScreen: false,
        include: ['js/**', 'css/**']
    }
};