// @vitest-environment node
//
// **Svelthon reaches Bryntime by one door**: it depends on the package and
// keeps no copy of it or of the engine, imports it by its entry alone, and at
// run time touches the engine only through it. What Bryntime is behind that
// door, its modules and what they import, is Bryntime's to hold, in its own
// tests.
import { test, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// And by what it says of it: a comment, a test, a note or a document of
// Svelthon's names the package, never a file of it, which is Bryntime's to
// split, move or rename. Twice after the split a sentence here went on naming
// one, a path into the package and then its list of the engine's repairs.
// This file holds the pattern, so it is the one file not read. An import of a
// file beside the one that imports it, Bryc's `./errors.js`, names its own.
const BRYNTIME_FILE =
    /bryntime\/[\w./-]+|BRYTHON_FIX|\b(?<!\.\/)(?:globals|boot|core|mutations|views|calls|errors|modules|protocols|brython_runtime|brython_compiler)\.js\b/;

test('no file of Svelthon names a file of Bryntime', () => {
    const within = (dir, keep) =>
        readdirSync(dir, { recursive: true })
            .filter(keep)
            .map((file) => join(dir, file));
    const files = [
        ...within('src/lib', (file) => /\.[cm]?js$/.test(file)),
        ...within('notes', (file) => file.endsWith('.md')),
        ...within('demo', (file) => /\.(js|svelte|py|html)$/.test(file)),
        ...readdirSync('tests')
            .filter((file) => file.endsWith('.js') && file !== 'crossing-standalone.test.js')
            .map((file) => `tests/${file}`),
        ...readdirSync('scripts')
            .filter((file) => file.endsWith('.sh'))
            .map((file) => `scripts/${file}`),
        'README.md',
        'README.fr.md',
        ...JSON.parse(readFileSync('package.json', 'utf8')).files.filter((file) => file.endsWith('.md'))
    ];
    const named = files.flatMap((file) =>
        readFileSync(file, 'utf8')
            .split('\n')
            .map((line, index) => [`${file}:${index + 1}`, line])
            .filter(([, line]) => BRYNTIME_FILE.test(line))
            .map(([where, line]) => `${where}: ${line.trim()}`)
    );

    expect(files.length).toBeGreaterThan(100);
    expect(named).toEqual([]);
});

test('Svelthon depends on Bryntime and keeps no copy of it or of the engine', () => {
    expect(JSON.parse(readFileSync('package.json', 'utf8')).dependencies).toHaveProperty('bryntime');
    expect(existsSync('src/lib/bryntime')).toBe(false);
    expect(existsSync('vendor')).toBe(false);
});

// Svelthon reaches Bryntime through the package's entry alone, which starts the
// engine and exports what Bryntime gives, so each of its files stays
// Bryntime's own to split or to move. The engine's other half, the parsing
// chain, is Bryc's to load, not its host's.
test('Svelthon reaches Bryntime through its entry alone', () => {
    const doors = readdirSync('src/lib')
        .filter((file) => /\.c?js$/.test(file))
        .flatMap((file) =>
            [...readFileSync(`src/lib/${file}`, 'utf8').matchAll(/(?:from\s+|require\(\s*|import\s+)['"](bryntime[^'"]*)['"]/g)].map(
                ([, to]) => `${file}: ${to}`
            )
        );

    expect(doors.length).toBeGreaterThan(0);
    expect(doors.filter((one) => !one.endsWith(': bryntime'))).toEqual([]);
});

// And through that door alone: at run time only Bryntime touches the engine,
// by its name or by the shape of its objects, and the host and the helpers ask
// it through Bryntime's functions. The compiler, which builds with the engine's
// other half and its AST, is exempted file by file, so a new file of the host
// is held to the rule from its first line. Comments may name the engine.
const COMPILER = ['compile.js', 'markup.js'];
const ENGINE_TOKENS = /\$B\b|__BRYTHON__|\b_b_\b|\btp_\w+|\bob_type\b|__traceback__|\.\$factory\b|\$store\b|\$js_func\b|\$lineno\b|\$proxy\b/;

test('at run time, nothing of Svelthon touches the engine', () => {
    const files = readdirSync('src/lib', { recursive: true }).filter((file) => /\.[cm]?js$/.test(file));
    const touching = files
        .filter((file) => !COMPILER.includes(file))
        .flatMap((file) =>
            readFileSync(`src/lib/${file}`, 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ''))
                .split('\n')
                .map((line, index) => [`${file}:${index + 1}`, line.replace(/(^|\s)\/\/.*$/, '')])
                .filter(([, code]) => ENGINE_TOKENS.test(code))
                .map(([where, code]) => `${where}: ${code.trim()}`)
        );

    expect(files).toEqual(expect.arrayContaining([...COMPILER, 'bridge.js']));
    expect(touching).toEqual([]);
});
