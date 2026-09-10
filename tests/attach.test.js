import { test, expect, describe } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import Attach from './fixtures/Attach.svelte';

// `{@attach fn}` is Svelte's replacement for `use:`, and it sits inside the tag
// rather than around it — which is why it used to cross the markup pass
// untouched, carrying its expression as JavaScript into a component that is
// Python everywhere else.
describe('attachments', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const component = mount(Attach, { target });
        flushSync();

        return {
            component,
            stamped: () => target.querySelector('p[data-k="target"]').getAttribute('data-stamped'),
            tipped: () => target.querySelector('p[data-k="tipped"]').getAttribute('data-tip'),
            rename: () => {
                target.querySelector('button').click();
                flushSync();
            }
        };
    };

    test('the attachment runs on mount, with the element', () => {
        expect(setup().stamped()).toBe('one');
    });

    // The point of an attachment over an action: it re-runs when the state it
    // read changes, because it runs inside an effect.
    test('and again when the state it read has changed', () => {
        const { stamped, rename } = setup();

        rename();
        expect(stamped()).toBe('two');
    });

    // The factory form, which is the one their own docs recommend — and the one
    // that proves the expression is Python: `tooltip(label)` is a call, not a
    // name, and `label` is read through the namespace.
    test('a factory is an expression like any other', () => {
        const { tipped, rename } = setup();

        expect(tipped()).toBe('ONE');
        rename();
        expect(tipped()).toBe('TWO');
    });

    test('what it returns is the teardown', () => {
        document.body.removeAttribute('data-cleaned');

        const { component } = setup();
        unmount(component, { outro: false });
        flushSync();

        expect(document.body.getAttribute('data-cleaned')).toBe('yes');
    });
});
