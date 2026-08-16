import { createRequire } from 'node:module';
import { relative } from 'node:path';

const require = createRequire(import.meta.url);
const { compile, VIRTUAL_PREFIX, VFS_PREFIX } = require('./compile.cjs');

// Generated modules, keyed by component name. Filled by the preprocessor when
// Svelte transforms a component, read back when Vite resolves the import that
// the preprocessor just wrote into that component's script.
const generated = new Map();

// Must be unique across the project *and* a valid JS identifier, since Brython
// derives its namespace binding (`locals_<name>`) from it.
const nameFor = (filename) => relative(process.cwd(), filename || 'Component').replace(/\W/g, '_');

// Find the '}' closing the block that opens at `start`, ignoring braces inside
// string literals.
function closingBrace(source, start) {
    let depth = 0;
    let quote = null;

    for (let i = start; i < source.length; i++) {
        const c = source[i];

        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
            continue;
        }

        if (c === '"' || c === "'" || c === '`') quote = c;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) return i;
    }

    return -1;
}

// `{#if items}` is a JavaScript condition, so an empty list — an object — reads
// as true where Python reads false. Same for an empty dict and for None. Route
// every condition through Python's own bool().
function pythonConditions(markup) {
    const opener = /\{(#if|:else\s+if)\s+/g;
    let out = '';
    let cut = 0;
    let match;

    while ((match = opener.exec(markup))) {
        const exprStart = match.index + match[0].length;
        const end = closingBrace(markup, match.index);
        if (end === -1) continue;

        out += markup.slice(cut, exprStart) + `py.truthy(${markup.slice(exprStart, end).trim()})`;
        cut = end;
        opener.lastIndex = end;
    }

    return out + markup.slice(cut);
}

// The Svelte preprocessor: runs before Svelte parses the component, so the
// compiler only ever sees ordinary JavaScript with runes.
export function python() {
    return {
        name: 'svelthon',
        markup({ content }) {
            if (!/<script[^>]*\blang=["']python["']/.test(content)) return;
            return { code: pythonConditions(content) };
        },
        script({ content, attributes, filename }) {
            if (attributes.lang !== 'python') return;

            const name = nameFor(filename);
            const { script, module, stdlib } = compile(content, name);

            generated.set(VIRTUAL_PREFIX + name, module);
            if (stdlib) generated.set(VFS_PREFIX + name, stdlib);

            return { code: script };
        }
    };
}

// The Vite plugin that serves those modules.
export function svelthon() {
    const isVirtual = (id) => id.startsWith(VIRTUAL_PREFIX) || id.startsWith(VFS_PREFIX);

    return {
        name: 'svelthon:modules',
        resolveId(id) {
            if (isVirtual(id)) return '\0' + id;
        },
        load(id) {
            if (id.startsWith('\0')) return generated.get(id.slice(1));
        }
    };
}
