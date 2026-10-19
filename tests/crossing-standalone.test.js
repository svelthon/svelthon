// @vitest-environment node
//
// **Bryntime stands without Svelte and without the runtime**: it is a package
// Svelthon depends on, of which Svelthon keeps no copy, whose modules import
// the engine and one another, nothing else, and loaded alone, with no host to
// answer, it still turns JavaScript values into Python ones and back. What a
// host adds, the states it owns and how it makes an object one of them, is
// asked through `host`, which answers nothing here.
import { test, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import '../src/lib/compile.cjs';
import { host, pyData, plainData, entering, pyBind, refused, NONE } from 'bryntime';

const require = createRequire(import.meta.url);
const DIR = dirname(require.resolve('bryntime/package.json'));
const ENGINE = './vendor/brython_runtime.js';
const IMPORTS = /^(?:import|export)\s+(?:[^'";]*\s+from\s+)?'([^']+)';/gm;

// Bryntime's modules, the ones its entry reaches, read as it ships them.
const modules = () => {
    const seen = new Set();
    const visit = (file) => {
        if (seen.has(file)) return;
        seen.add(file);
        for (const [, from] of readFileSync(join(DIR, file), 'utf8').matchAll(IMPORTS)) {
            if (/^\.\/[\w-]+\.js$/.test(from)) visit(from.slice(2));
        }
    };

    visit(JSON.parse(readFileSync(join(DIR, 'package.json'), 'utf8')).main.replace(/^\.\//, ''));
    return [...seen];
};

test('Svelthon depends on Bryntime and keeps no copy of it or of the engine', () => {
    expect(JSON.parse(readFileSync('package.json', 'utf8')).dependencies).toHaveProperty('bryntime');
    expect(existsSync('src/lib/bryntime')).toBe(false);
    expect(existsSync('vendor')).toBe(false);
});

test('Bryntime imports the engine and itself, and nothing of Svelte or of the runtime', () => {
    const imports = modules().flatMap((file) =>
        [...readFileSync(join(DIR, file), 'utf8').matchAll(IMPORTS)].map(([, from]) => `${file}: ${from}`)
    );

    expect(modules()).toContain('bryntime.js');
    expect(imports).toContain(`boot.js: ${ENGINE}`);
    expect(imports.filter((one) => !one.endsWith(`: ${ENGINE}`) && !/: \.\/[\w-]+\.js$/.test(one))).toEqual([]);
});

// And by one door: Svelthon reaches Bryntime through the package's entry alone,
// which starts the engine and exports its neighbours, so each of the others
// stays Bryntime's own to split or to move; and the compiler reaches the
// engine's other half through the entry Bryntime gives it.
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

// And by name: what it writes on the engine, signs its refusals with and
// recognises them by is its own. Its comments may take Svelte for an example;
// a line of code that names Svelthon or Svelte is a contract a page without
// them would have to keep.
test('no line of code of Bryntime names Svelthon or Svelte', () => {
    const named = modules().flatMap((file) =>
        readFileSync(join(DIR, file), 'utf8')
            .split('\n')
            .map((line, index) => [`${file}:${index + 1}`, line.replace(/(^|\s)\/\/.*$/, '')])
            .filter(([, code]) => /svelthon|svelte/i.test(code))
            .map(([where, code]) => `${where}: ${code.trim()}`)
    );

    expect(named).toEqual([]);
});

test('loaded alone, with no host, it crosses data both ways', () => {
    const $B = globalThis.__BRYTHON__;
    const python = pyData({ name: 'a', rows: [1, 2.5, { deep: null }] });

    expect($B.class_name(python)).toBe('dict');
    // `null` comes in as `javascript.NULL` and goes out as `null`.
    expect(plainData(python)).toEqual({ name: 'a', rows: [1, 2.5, { deep: null }] });
    expect(pyBind(undefined)).toBe(NONE);
    expect(host.owns(python)).toBe(false);
    expect($B.class_name(entering({ n: 1 }))).toBe('dict');
});

// With no host to answer how its reactions read and write, every read is taken
// for a reaction's, nothing is refused, nobody subscribes, and a call that
// reads without following runs as it is.
test('alone, it follows nothing and refuses nothing', () => {
    let started = 0;
    const join = host.subscriber(() => {
        started += 1;
        return () => {};
    });

    expect(host.reacting()).toBe(true);
    expect(host.refuses()).toBe(false);
    join();
    expect(started).toBe(0);
    expect(host.untrack(() => 7)).toBe(7);
});

// With no host to give its name, a refusal is signed with Bryntime's own, and
// known as one by `refused`.
test('alone, it signs its refusals with its own name', () => {
    const $B = globalThis.__BRYTHON__;
    const keys = $B.builtins.dict.$factory();
    let thrown;

    $B.$setitem(keys, 1, 'numeric');
    $B.$setitem(keys, '1', 'text');

    try {
        plainData(keys);
    } catch (error) {
        thrown = error;
    }

    expect(host.name).toBe('bryntime');
    expect(thrown.message).toMatch(/^bryntime — this dict has two keys JavaScript cannot tell apart/);
    expect(refused(thrown)).toBe(true);
    expect(refused(new Error('bryntime — written by hand'))).toBe(false);
});
