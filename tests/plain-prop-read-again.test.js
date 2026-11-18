import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import PlainPropParent from './fixtures/PlainPropParent.svelte';
import PlainImportParent from './fixtures/PlainImportParent.svelte';
import RecordParent from './fixtures/RecordParent.svelte';
import ElementSpreadParent from './fixtures/ElementSpreadParent.svelte';
import HandedRoot from './fixtures/HandedRoot.svelte';

const shownIn = (target) => (side) => {
    const root = target.querySelector(`[data-k="${side}"]`);

    return [root.querySelector('p').dataset.x, root.querySelector('p').textContent, root.querySelector('b').textContent, root.querySelector('i').textContent];
};

// An expression that calls nothing and reads JavaScript's own data is read again
// each time the effect that renders it runs, as Svelte reads the author's own: a
// JavaScript object no state holds, changed in place, shows its new field once
// the page renders again for another reason, in its attribute, its text, an
// expression and inside a `<svelte:boundary>`. Every Python expression being a
// call, Svelte held each in a derived until what it read changed, and the
// Python child kept the old field beside the new count.
test('a field of an object changed in place is read again when the page renders again', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(PlainPropParent, { target });
    const shown = shownIn(target);

    flushSync();
    instance.change();
    flushSync();

    expect([shown('python'), shown('svelte')]).toEqual([
        ['b', 'b|1', 'b!', 'b|1'],
        ['b', 'b|1', 'b!', 'b|1']
    ]);
});

// And of an object a JavaScript module hands, which Python reads by the
// engine's own door to an attribute, where no prop counts it.
test('a field of an object a module hands, changed in place, is read again as well', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(PlainImportParent, { target });
    const shown = shownIn(target);

    flushSync();
    instance.change();
    flushSync();

    expect([shown('python'), shown('svelte')]).toEqual([
        ['b', 'b|1', 'b!', 'b|1'],
        ['b', 'b|1', 'b!', 'b|1']
    ]);
});

// And in a loop's row, a snippet's parameter and a spread, each read in a
// derived of its block's or of its own: held, a link in a loop opened the
// record it had left, the snippet's link went there under the new label, and a
// button the parent disabled stayed clickable.
test('a row, a parameter and a spread of a record changed in place are read again', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(RecordParent, { target });
    const shown = (side) => {
        const root = target.querySelector(`[data-k="${side}"]`);
        const link = (k) => [root.querySelector(`[data-k="${k}"]`).getAttribute('href'), root.querySelector(`[data-k="${k}"]`).textContent];
        const button = root.querySelector('[data-k="spread"]');

        return [link('row'), link('snippet'), [button.disabled, button.getAttribute('aria-label')]];
    };

    flushSync();
    instance.next();
    flushSync();

    expect([shown('python'), shown('svelte')]).toEqual([
        [['/record/B', 'Open B (1)'], ['/record/B', 'Open B (1)'], [true, 'Save B']],
        [['/record/B', 'Open B (1)'], ['/record/B', 'Open B (1)'], [true, 'Save B']]
    ]);
});

// And a spread on a `<svelte:element>`, of a dict changed in place as of the
// record: the derived holding the dict itself held the same object after the
// write, which Svelte took for no change, and the element kept its old title.
// A call there is made again only when what it read changes, as Svelte's:
// read through the getter, it was made again at each render.
test('a dict changed in place and a record, spread on a svelte:element, are read again', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(ElementSpreadParent, { target });
    const shown = (side) => {
        const at = (k) => target.querySelector(`[data-k="${side}"] [data-k="${k}"]`);

        return [
            at('named').title,
            at('written').title,
            at('plain').title,
            at('nested').className,
            at('record').title,
            at('block').title,
            at('made').dataset.c,
            at('locked').hidden,
            at('filled').hidden
        ];
    };

    flushSync();
    for (const side of ['python', 'svelte']) target.querySelector(`[data-k="${side}"] [data-k="go"]`).click();
    instance.change();
    flushSync();

    expect([shown('python'), shown('svelte'), instance.made()]).toEqual([
        ['t2', 't2', 't2', 'a b', 'r2', 't2', '1', true, true],
        ['t2', 't2', 't2', 'a b', 'r2', 't2', '1', true, true],
        [1, 1]
    ]);
});

// And a prop a Python parent hands a component, which the child reads each
// time it reads it, as a Svelte child reads the getter its parent wrote: named,
// spread, between quotes, from a row or a snippet's parameter, as a CSS
// property and to a child the script holds. Svelte held each in a derived of
// its own, and the child showed, and picked when clicked, the record the parent
// had left. A prop that is neither a name nor a member Svelte holds in one of
// its own, and the value between quotes it is part of, and so does Svelthon.
test('a prop a Python parent hands is read again each time the child reads it', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(HandedRoot, { target });
    const forms = ['named', 'spread', 'quoted', 'row', 'snippet', 'held', 'sum', 'mixed'];
    const shown = (side) => {
        const at = (k) => target.querySelector(`[data-k="${side}"] [data-k="${k}"]`);

        for (const form of forms) at(`${form}-pick`).click();
        flushSync();

        return [
            ...forms.map((form) => [at(form).getAttribute('href'), at(form).textContent, at(`${form}-pick`).textContent]),
            at('css').closest('svelte-css-wrapper').style.getPropertyValue('--theme')
        ];
    };

    flushSync();
    instance.next();
    flushSync();

    const read = ['/record/B', 'B (1)', 'B'];
    const held = ['/record/A', 'A! (1)', 'A!'];
    const seen = [read, read, ['/record/B', 'Open B (1)', 'Open B'], read, read, read, held, held, 'blue'];

    expect([shown('python'), shown('svelte')]).toEqual([seen, seen]);
});
