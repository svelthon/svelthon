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

// The Svelte preprocessor: runs before Svelte parses the component, so the
// compiler only ever sees ordinary JavaScript with runes.
export function python() {
    return {
        name: 'svelthon',
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
