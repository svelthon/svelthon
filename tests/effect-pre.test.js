import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import EffectPre from './fixtures/EffectPre.svelte';

// `@effect.pre` runs before the DOM is updated rather than after — Svelte's own
// words: "apart from the timing, `$effect.pre` works exactly like `$effect`".
// Their canonical case is autoscroll, which has to read a scroll position before
// the height it depends on changes.
//
// The dotted name is PEP 318's original grammar, and the one Python uses to name
// a variant of something: `@property` and `@x.setter`.
describe('@effect.pre', () => {
    const setup = () => {
        document.body.setAttribute('data-order', '');

        const target = document.body.appendChild(document.createElement('div'));
        mount(EffectPre, { target });
        flushSync();

        return {
            order: () => document.body.getAttribute('data-order'),
            bump: () => {
                target.querySelector('button').click();
                flushSync();
            }
        };
    };

    test('it runs, like any effect', () => {
        expect(setup().order()).toContain('<');
    });

    // The ordering is the whole feature: `<` is the pre-effect, `>` the plain
    // one, and the pair must arrive in that order.
    test('and it runs before a plain effect', () => {
        expect(setup().order()).toBe('<>');
    });

    test('it re-runs when what it read has changed', () => {
        const { order, bump } = setup();

        bump();
        expect(order()).toBe('<><>');
    });
});
