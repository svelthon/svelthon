// A `bind:` on a name the markup declared, `{amount = 0.25}`, handed Svelte the
// cell as it stood, and the cell holds a Python value: a text field showed
// `[object Object]` for a float, a number field showed nothing, `None` showed
// `None`, neither select found its option, and `bind:files` on `None` failed to
// mount with `Failed to convert value to 'FileList'`. The model read right all
// along, so a test of the model alone saw nothing: the DOM is what is compared
// here, against the same component written in Svelte.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import MarkupCellBindings from './fixtures/MarkupCellBindings.svelte';
import MarkupCellBindingsNative from './fixtures/MarkupCellBindingsNative.svelte';
import MarkupCellFiles from './fixtures/MarkupCellFiles.svelte';
import MarkupCellFilesNative from './fixtures/MarkupCellFilesNative.svelte';

const mounted = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    const at = (key) => target.querySelector(`[data-k="${key}"]`);
    const read = () => ({
        number: at('number').value,
        text: at('text').value,
        range: at('range').value,
        nothing: at('nothing').value,
        select: at('select').selectedIndex,
        many: [...at('many').selectedOptions].map((one) => one.textContent),
        amount: at('amount').textContent,
        selected: at('selected').textContent
    });
    // A select is chosen by index: an option's `value` attribute is the text
    // the DOM keeps, not the number the binding compares.
    const input = (key, value) => {
        if (key === 'select') at(key).selectedIndex = value;
        else at(key).value = value;

        at(key).dispatchEvent(new Event(key === 'select' ? 'change' : 'input', { bubbles: true }));
        flushSync();
    };

    return { read, input };
};

test('every control shows the value the markup declared, as in Svelte', () => {
    expect(mounted(MarkupCellBindings).read()).toEqual(mounted(MarkupCellBindingsNative).read());
});

// The write half: the setter still lands in the markup's own cell, and the
// value it lands as is read back by Python and by every other control.
test.for([
    ['a number typed', 'number', '0.75'],
    ['a whole number typed', 'number', '3'],
    ['text typed', 'text', 'abc'],
    ['an option chosen', 'select', 1]
])('%s reaches the cell and the other controls, as in Svelte', ([, key, value]) => {
    const python = mounted(MarkupCellBindings);
    const native = mounted(MarkupCellBindingsNative);

    python.input(key, value);
    native.input(key, value);

    expect(python.read()).toEqual(native.read());
});

test('a file input bound to a declared None mounts, and shows no file, as in Svelte', () => {
    const page = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Component, { target });
        flushSync();
        return target.querySelector('p').textContent;
    };

    expect(page(MarkupCellFiles)).toBe(page(MarkupCellFilesNative));
});
