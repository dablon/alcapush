import esbuild from 'esbuild';
import { chmodSync } from 'fs';

esbuild
    .build({
        entryPoints: ['./src/cli.ts'],
        bundle: true,
        platform: 'node',
        target: 'node18',
        outfile: './out/cli.cjs',
        format: 'cjs',
        external: [
            // External dependencies that should not be bundled
            'tiktoken',
            '@dqbd/tiktoken'
        ],
        minify: true,
        sourcemap: false,
        banner: {
            js: '#!/usr/bin/env node'
        }
    })
    .then(() => {
        // Make it executable on Unix systems
        try {
            chmodSync('./out/cli.cjs', '755');
        } catch (e) {
            // Ignore on Windows
        }
        console.log('Build completed successfully!');
    })
    .catch(() => process.exit(1));
