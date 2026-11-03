// The production build's weight held against the figure the README states: what
// the demo page loads, its script, the modules it preloads and its styles,
// gzipped, in KB of 1024 bytes as Bryntime counts its own. Run by
// `browser-check.sh` after it builds.
//
// `README.md` alone, because it is the one the others are held against:
// `tests/documented-figures.test.js` fails when `README.fr.md` or the demo
// states another figure. Two reviews read this file alone and took the other
// two for unchecked.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = process.argv[2] ?? 'dist';
const html = readFileSync(join(dist, 'demo/index.html'), 'utf8');
const loaded = [...new Set([...html.matchAll(/(?:src|href)="\/([^"]+\.(?:js|css))"/g)].map((match) => match[1]))];
const measured = Math.round(loaded.reduce((total, file) => total + gzipSync(readFileSync(join(dist, file))).length, 0) / 1024);
const stated = Number(readFileSync('README.md', 'utf8').match(/production build: \*\*(\d+) KB gzip\*\*/)[1]);

if (measured === stated) {
    console.log(`✓ production build — ${measured} KB gzip in ${loaded.length} files, as the README states`);
} else {
    console.log(`✗ production build — ${measured} KB gzip in ${loaded.length} files, where the README states ${stated}`);
    process.exit(1);
}
