// @vitest-environment node
//
// **Svelthon reaches Bryntime by one door**: it depends on the package and
// keeps no copy of it or of the engine, imports it by its entry alone, and at
// run time touches the engine only through it. What Bryntime is behind that
// door, its modules and what they import, is Bryntime's to hold, in its own
// tests.
import { test, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

test('Svelthon depends on Bryntime and keeps no copy of it or of the engine', () => {
    expect(JSON.parse(readFileSync('package.json', 'utf8')).dependencies).toHaveProperty('bryntime');
    expect(existsSync('src/lib/bryntime')).toBe(false);
    expect(existsSync('vendor')).toBe(false);
});

// Svelthon reaches Bryntime through the package's entry alone, which starts the
// engine and exports what Bryntime gives, so each of its files stays
// Bryntime's own to split or to move; and the compiler reaches the engine's
// other half through the entry Bryntime gives it.
test('Svelthon reaches Bryntime through its entry alone', () => {
    const doors = readdirSync('src/lib')
        .filter((file) => /\.c?js$/.test(file))
        .flatMap((file) =>
            [...readFileSync(`src/lib/${file}`, 'utf8').matchAll(/(?:from\s+|require\(\s*|import\s+)['"](bryntime[^'"]*)['"]/g)].map(
                ([, to]) => `${file}: ${to}`
            )
        );

    expect(doors.length).toBeGreaterThan(0);
    expect(doors.filter((one) => !one.endsWith(': bryntime') && one !== 'compile.cjs: bryntime/compiler')).toEqual([]);
});

// And through that door alone: at run time only Bryntime touches the engine,
// by its name or by the shape of its objects, and the host and the helpers ask
// it through Bryntime's functions. The compiler, which builds with the engine's
// other half and its AST, is exempted file by file, so a new file of the host
// is held to the rule from its first line. Comments may name the engine.
const COMPILER = ['compile.cjs', 'markup.js'];
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

    expect(files).toEqual(expect.arrayContaining([...COMPILER, 'bridge.js', 'helpers.js']));
    expect(touching).toEqual([]);
});
