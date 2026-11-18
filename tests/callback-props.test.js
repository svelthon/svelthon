// **A prop whose name starts with `on`, handed on by a Python component from a
// field of a JavaScript object, follows the field as any other prop does.** The
// handlers' branch made the prop a call Svelte holds the answer of, which a
// field replaced in place does not change: the text and the callback stayed
// the first ones, and a confirmation acted on the first selection. For a
// JavaScript and a Python child, imported or handed as a prop.
import { test, expect } from 'vitest';
import { mount, flushSync, unmount } from './mounted.js';
import CallbackPropsHost from './fixtures/CallbackPropsHost.svelte';

test('a prop named on… follows the field of a JavaScript object it is read from', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(CallbackPropsHost, { target });
    const sections = ['direct', 'direct-python', 'held', 'held-python'];
    const seen = () =>
        sections.map((one) => {
            const section = target.querySelector(`[data-k="${one}"]`);

            section.querySelector('button').click();
            flushSync();

            return `${section.querySelector('[data-k="preview"]').textContent} ${section.querySelector('[data-k="receipt"]').textContent}`;
        });

    flushSync();
    instance.select('B');
    flushSync();

    const afterB = seen();

    instance.select('C');
    flushSync();

    expect([afterB, seen()]).toEqual([Array(4).fill('1|B|B B|B|B|B'), Array(4).fill('2|C|C C|C|C|C')]);

    await unmount(instance);
    target.remove();
});
