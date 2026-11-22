// @vitest-environment node
//
// The line a refusal of the script names is the file's, the script's own line
// moved by where the script starts. Every message here was asserted by its
// sentence alone, and so on a script written at the top of a file or not
// through a file at all, where the offset is nothing: subtracted rather than
// added, it named a line above the script, and no test saw it.
import { test, expect } from 'vitest';
import { preprocess } from 'svelte/compiler';
import { python } from '../src/lib/svelthon.js';

const FILE = 'src/App.svelte';

// The script starts on line 3, so its first line is the file's fourth.
const refused = (script) =>
    preprocess(`<!-- a comment -->\n\n<script lang="python">\n${script}\n</script>\n\n<p>ok</p>\n`, [python()], { filename: FILE }).then(
        () => null,
        (error) => error.message
    );

test.for([
    ['a name the compiler writes', '__brycomp_expr_9 = 1', 'is a name the compiler writes itself', 4],
    ['a marker on a name declared above', 'x = 1\n\n@export\ndef x():\n    return 1', 'would be read on a name the first declaration', 6],
    ['a marker called alone', 'def f():\n    pass\n\neffect(f)', 'written alone declares nothing', 7],
    ['a marker inside an expression', 'def f():\n    return 1\n\nprint(derived(f))', 'is read only as the whole value of an assignment', 7]
])('%s is refused at its line of the file', async ([, script, sentence, line]) => {
    const message = await refused(script);

    expect(message).toContain(sentence);
    expect(message).toContain(`(${FILE}:${line})`);
});

// And the line of the declaration it would be read against, the file's too.
test('a marker on a name declared above names the line that declared it', async () => {
    expect(await refused('x = 1\n\n@export\ndef x():\n    return 1')).toContain('`x` is already declared at line 4,');
});
