// @vitest-environment node
//
// A Python parent hands a Python child the value itself and a JavaScript child
// JavaScript's own, and tells the two apart by reading the child's file. That
// file is a dependency of the parent: read without saying so, a child turned
// from JavaScript to Python left its parent compiled for the old language on a
// dev server, until something else changed it or the server restarted.
import { test, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preprocess } from 'svelte/compiler';
import { python } from '../src/lib/svelthon.js';

const room = mkdtempSync(join(tmpdir(), 'svelthon-children-'));

afterAll(() => rmSync(room, { recursive: true, force: true }));

const parent = `<script lang="python">\nimportjs Child from "./Child.svelte"\nprice = 0.5\n</script>\n\n<Child {price} />\n`;
const child = join(room, 'Child.svelte');
const filename = join(room, 'Parent.svelte');

const compiled = async () => preprocess(parent, [python()], { filename });

test('the child read is a dependency, and its language decides the prop', async () => {
    writeFileSync(child, '<script>\n    let { price } = $props();\n</script>\n<p>{price}</p>\n');

    const forJavaScript = await compiled();

    expect(forJavaScript.dependencies).toContain(child);
    expect(forJavaScript.code).not.toMatch(/__expr_py_/);

    writeFileSync(child, '<script lang="python">\nprice: float\n</script>\n<p>{price}</p>\n');

    const forPython = await compiled();

    expect(forPython.dependencies).toContain(child);
    expect(forPython.code).toMatch(/__expr_py_/);
});
