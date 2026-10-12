// @vitest-environment node
//
// Two configurations in one process must not read each other's search path.
//
// `python(options)` writes its path onto a global as it is constructed, because
// the preprocessor and the plugin may not be the same module instance and that
// value is the only channel between them. The resolution then read the global
// unconditionally, so **building a second preprocessor changed what the first
// one resolved**: an `import` that had produced a dependency stopped producing
// one, and the second never compiled anything.
//
// Found by an outside reading, which reproduced it through the real hooks rather
// than by reasoning about the code.
import { test, expect, describe } from 'vitest';
import { preprocess } from 'svelte/compiler';

import { python, svelthon } from '../src/lib/svelthon.js';

const COMPONENT = `<script lang="python">
import shapes

x = 1
</script>

<p>{x}</p>
`;

// The importer's own directory is searched first, and `demo` holds no
// `shapes.py`, so only the configured path can find the one in
// `tests/fixtures`. The name has to be a file that exists, because the `script`
// hook reads the source back to map its lines.
const FILE = 'demo/App.svelte';

// The prelude does not go into the code the hook returns: it goes into the
// component's virtual module, which is where the audit read it. That map is on
// the global on purpose, since the two halves may be two module instances.
const generated = globalThis[Symbol.for('svelthon.generated')];

const compile = async (preprocessor) => {
    await preprocess(COMPONENT, [preprocessor], { filename: FILE });

    return [...generated.values()].map((one) => one.code ?? one).join('\n');
};

describe('a second configuration leaves the first alone', () => {
    test('the path resolves an import at all, which is what the rest measures', async () => {
        const a = python({ path: ['tests/fixtures'] });

        expect(await compile(a)).toContain('shapes.py');
    });

    // The reproduction, in the order the audit found it: A compiles, B is built
    // and compiles nothing, A compiles the same content again.
    // Not a byte comparison of the two passes: the virtual-module map is global
    // and accumulates across a file, so the comparison would measure the map
    // rather than the resolution. What the audit demonstrated is the import
    // disappearing, and that is what this asks.
    test('and keeps resolving it after a second one is built', async () => {
        const a = python({ path: ['tests/fixtures'] });

        expect(await compile(a)).toContain('shapes.py');

        python({ path: [] });

        expect(await compile(a)).toContain('shapes.py');
    });

    // The other order, which the audit asked for and which the old code passed
    // by luck: B first, then A, then B again. B's path finds no `shapes`, so B
    // refuses the import.
    test('in either order', async () => {
        const b = python({ path: [] });
        const a = python({ path: ['tests/fixtures'] });

        expect(await compile(a)).toContain('shapes.py');
        await expect(compile(b)).rejects.toThrow(/`shapes` is not a module a component can import/);
    });

    // The plugin is the half that cannot tell configurations apart, so it takes
    // the path when it is given one rather than reading whatever was left on the
    // global by the last `python()` built.
    test('and the plugin can be told which path is its own', () => {
        expect(svelthon({ path: ['tests/fixtures'] }).name).toBe('svelthon:modules');
        expect(svelthon().name).toBe('svelthon:modules');
    });
});
