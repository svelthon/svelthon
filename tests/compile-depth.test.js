// @vitest-environment node
//
// The walks over a module's statements visit each block once, so compiling costs
// what the source holds, whatever its depth. A walk that visits a body twice per
// level is 2^depth: 26 nested blocks were tens of seconds. Measured against 13
// (`growth`): twice the depth takes about as long, where a walk twice per level
// took 2^13 times longer.
import { test, expect } from 'vitest';
import { growth, timed } from './growth.js';
import { compile } from '../src/lib/compile.js';

const nested = (depth, inner) =>
    Array.from({ length: depth }, (_, i) => `${'    '.repeat(i)}if True:`).join('\n') +
    `\n${'    '.repeat(depth)}${inner}\n`;

test('a deeply nested module compiles in linear time', () => {
    const compiled = (depth) => timed(() => compile(nested(depth, 'x = 1'), 'Deep', 'deep.svelte'));

    expect(growth(compiled, { from: 13, factor: 2, until: 0 })).toBeLessThan(8);
});

// The walk that finds `global` still reaches every block it is written in.
test('a global written deep inside a function is still a name of the module', () => {
    const source = `def reset():\n${nested(6, 'global message').replace(/^/gm, '    ')}    message = 1\n`;
    const { script } = compile(source, 'Deep', 'deep.svelte');

    expect(script).toContain("__bind(__proto, 'message'");
});
