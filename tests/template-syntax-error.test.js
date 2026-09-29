// @vitest-environment node
//
// A syntax error in a template expression is reported where it is written, as
// an error raised there at run time already is: the template functions are
// compiled after the script, and the table that maps their Python lines back to
// the markup serves the compile as it serves the runtime. The message quotes
// the expression and says what Python writes for the JavaScript habit in it.
import { test, expect } from 'vitest';
import { preprocess } from 'svelte/compiler';
import { python } from '../src/lib/svelthon.js';

const refused = async (markup) => {
    const source = `<script lang="python">\nok = True\ncount = 0\nitems = []\n</script>\n${markup}`;

    try {
        await preprocess(source, [python()], {});
    } catch (error) {
        return error;
    }

    throw new Error('expected a refusal');
};

test('a ternary far below the script names its own line', async () => {
    const error = await refused(`${'<p>x</p>\n'.repeat(40)}{ok ? "yes" : "no"}\n`);

    expect(error.message).toMatch(/\(Component:46:2\)/);
    expect(error.start).toEqual({ line: 46, column: 1 });
});

test('and so does the third expression of a file, at its own column', async () => {
    const error = await refused(`<p>{count}</p>\n<p>{ok}</p>\n<p>{ok ? "yes" : "no"}</p>\n`);

    expect(error.message).toMatch(/\(Component:8:5\)/);
    expect(error.start).toEqual({ line: 8, column: 4 });
});

// A conversion is not a negation: `!r` belongs in an f-string field.
test('a conversion outside an f-string is not called a negation', async () => {
    const error = await refused('{count!r}\n');

    expect(error.message).not.toContain('`not x`');
});

test.for([
    ['{ok ? "yes" : "no"}', '`b if a else c`'],
    ['{#if !ok}x{/if}', '`not x`'],
    ['{#if count === 1}x{/if}', '`==`'],
    ['{ok && "yes"}', '`and`'],
    ['<button onclick={() => count++}>x</button>', '`lambda'],
    ['<button onclick={() => items.push(1)}>x</button>', '`.append(x)`']
])('%s says what Python writes', async ([markup, said]) => {
    const error = await refused(`${markup}\n`);

    expect(error.message).toContain('in the template expression');
    expect(error.message).toContain(said);
});

// A sign inside a string is not a habit: the expression is valid Python.
test('control: a string holding the signs compiles', async () => {
    const source = `<script lang="python">\nx = ""\n</script>\n{"a ? b : c && !d" + x}\n`;

    await expect(preprocess(source, [python()], {})).resolves.toBeDefined();
});
