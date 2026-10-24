// **A function the template makes reads its block's names as the block holds
// them when it is called**, as a Python closure reads its variable: a lambda's
// body, and what a generator expression makes past its first iterable, run
// after the expression has. Handed each name as a value, a function an action
// kept read the row it was made with after the row was replaced, a cell its
// old text, and an index its old position. What Python reads as the function
// is made, a default or a factory's argument, stays what it read.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import TemplateClosures from './fixtures/TemplateClosures.svelte';
import { saved, writeSaved } from './fixtures/template_closures.js';

test('a function the template hands an action reads its block as it is when called', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(TemplateClosures, { target });
    flushSync();

    const keys = ['object', 'optional', 'generator', 'comprehension', 'default', 'factory', 'cell', 'scalar', 'index-1'];
    const kept = Object.fromEntries(keys.map((key) => [key, saved[key]]));
    const read = () => keys.map((key) => [key, String(kept[key]())]);
    const before = read();

    instance.change();
    const field = target.querySelector('[data-k="field"]');
    field.value = 'second';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    expect(before).toEqual(keys.map((key) => [key, key === 'index-1' ? '0' : 'first']));
    expect(read()).toEqual([
        ['object', 'second'],
        ['optional', 'second'],
        ['generator', 'second'],
        ['comprehension', 'second'],
        ['default', 'first'],
        ['factory', 'first'],
        ['cell', 'second'],
        ['scalar', 'second'],
        ['index-1', '1']
    ]);
});

// And the write half of a binding, which makes its target again as it writes:
// a function the target keeps then reads the block as the read half's does.
// Asked of the read alone, the write's kept the row, the cell and the index it
// was handed, while a default stays what it read.
test('a function a binding’s write makes reads its block as it is when called', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(TemplateClosures, { target });
    flushSync();

    const type = (key, text) => {
        const input = target.querySelector(`[data-k="${key}"]`);
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        flushSync();
    };

    for (const key of ['write-object', 'write-mixed', 'write-cell', 'write-index-1']) type(key, 'typed');

    const keys = ['object', 'mixed', 'cell', 'index-1'];
    const kept = Object.fromEntries(keys.map((key) => [key, writeSaved[key]]));
    const read = () => keys.map((key) => [key, String(kept[key]())]);
    const before = read();

    instance.change();
    type('field', 'second');

    expect(before).toEqual([
        ['object', 'first'],
        ['mixed', 'first first'],
        ['cell', 'first'],
        ['index-1', '0']
    ]);
    expect(read()).toEqual([
        ['object', 'second'],
        ['mixed', 'first second'],
        ['cell', 'second'],
        ['index-1', '1']
    ]);
});
