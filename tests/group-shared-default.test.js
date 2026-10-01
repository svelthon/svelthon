// **Rows handed one default list are still two groups.** A group is the target
// its binding writes, and two rows of an `{#each}` are two targets even when
// both hold the same list: keying the rows on the list they hold merged them,
// so ticking `b` on the second row wrote `['a', 'b']` there, an `a` no control
// of that row carries. The same key served the reset rebuild, with the same
// result.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupSharedDefault from './fixtures/GroupSharedDefault.svelte';

describe('rows sharing a default list', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(GroupSharedDefault, { target });
        flushSync();

        return {
            instance,
            target,
            read: () => String(instance.read()),
            input: (k) => target.querySelector(`input[data-k="${k}"]`),
            click: (k) => {
                target.querySelector(`input[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('collect each row on its own when a box is ticked', () => {
        const { read, click } = setup();

        click('named-2');
        expect(read()).toBe('a / b');
    });

    test('and through an index as well as through the row', () => {
        const { read, click } = setup();

        click('indexed-1');
        expect(read()).toBe('a / b');
    });

    test('and after a keyed block reorders them', () => {
        const { instance, read, click } = setup();

        instance.swap();
        flushSync();
        click('keyed-2');

        // Row 2 now comes first.
        expect(read()).toBe('b / a');
    });

    test('rebuild each row on its own after a form reset', async () => {
        const { target, read, input } = setup();

        for (const k of ['named-1', 'named-2']) input(k).defaultChecked = true;

        target.querySelector('form[data-k="named"]').reset();
        await Promise.resolve();
        flushSync();

        expect(read()).toBe('a / b');
    });
});
