// **A select a spread makes multiple is bound as one written `multiple`**, as
// Svelte binds it, by what the element is. The pair was chosen off the tag's
// text, which names no `multiple`: the model's None missed its option, and a
// choice wrote back a `JavascriptArray` where the written attribute writes a
// list.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SpreadMultiple from './fixtures/SpreadMultiple.svelte';
import SpreadMultipleNative from './fixtures/SpreadMultipleNative.svelte';
import SpreadMultipleSwap from './fixtures/SpreadMultipleSwap.svelte';
import SpreadMultipleSwapNative from './fixtures/SpreadMultipleSwapNative.svelte';

const run = (Component, props) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props });
    flushSync();

    const select = target.querySelector('select');
    const shown = () => [...select.options].map((one) => one.selected);
    const before = shown();

    [...select.options].forEach((one, at) => (one.selected = at === 1));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    return { before, after: shown(), model: instance.model() };
};

test.for(
    ['Python', 'Svelte'].flatMap((language) =>
        [
            ['none', [true, false]],
            ['number', [false, true]]
        ].flatMap(([held, before]) => [true, false].map((spread) => [language, held, spread, before]))
    )
)('%s: a select whose model holds %s, made multiple by a spread %s, is bound as a multiple one', ([language, held, spread, before]) => {
    const Component = language === 'Python' ? SpreadMultiple : SpreadMultipleNative;

    expect(run(Component, { held, spread })).toEqual({ before, after: [false, true], model: 'list' });
});

// **And one the spread turns single, then multiple again, keeps its model
// selected**, the list being the selection of the multiple select and the value
// of an option of the single one. The read did not follow the element's mode:
// Svelte selected with the list made for a multiple select, and no option of
// the single one stayed selected.
test.for(['none', 'float', 'dict'].flatMap((kind) => ['field', 'whole'].map((form) => [kind, form])))(
    'a select a spread turns single and back, holding a %s, by its %s, keeps its model selected, as Svelte’s does',
    async ([kind, form]) => {
        const trace = async (Component) => {
            const target = document.body.appendChild(document.createElement('div'));
            const instance = mount(Component, { target, props: { kind, form } });
            const select = () => target.querySelector('select');
            const seen = [];
            const settle = async () => {
                flushSync();
                await Promise.resolve();
                flushSync();
                seen.push([select().multiple, ...[...select().options].map((one) => one.selected)]);
            };

            await settle();
            for (let swap = 0; swap < 3; swap++) {
                instance.swap();
                await settle();
            }

            return seen;
        };

        const native = await trace(SpreadMultipleSwapNative);

        expect(native).toEqual([
            [true, true, false],
            [false, true, false],
            [true, true, false],
            [false, true, false]
        ]);
        expect(await trace(SpreadMultipleSwap)).toEqual(native);
    }
);
