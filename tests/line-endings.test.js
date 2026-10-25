// **A script whose lines end with `\r\n`, or `\r`, compiles as one whose lines
// end with `\n`**, as Python reads all three as one line break. The compiler
// rewrites the dialect line by line, and a line's `\r` ended up inside what it
// wrote, `bindable((1\r))`, where Python read a new line: the lines the tree
// gave were no longer the text's, and the compile refused a marker it could not
// find, `the marker \`derived\` is not where its line says`.
import { test, expect } from 'vitest';
import { compile } from '../src/lib/compile.js';

const lines = [
    'count: int <=> 1',
    'doubled => count * 2',
    'tripled => count * 3',
    '=> print(doubled)',
    'quadrupled => count * 4',
    'shown: int <=> 2',
    '',
    '@derived',
    'def fifth():',
    '    return count * 5',
    ''
];

test.for([
    ['\\r\\n', '\r\n'],
    ['\\r', '\r']
])('a script whose lines end with %s compiles as one whose lines end with \\n', ([, end]) => {
    const plain = compile(lines.join('\n'), 'S', 'src/S.svelte');
    const ended = compile(lines.join(end), 'S', 'src/S.svelte');

    expect(ended.script).toBe(plain.script);
    expect(ended.module).toBe(plain.module);
});
