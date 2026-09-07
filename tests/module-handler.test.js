import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import ModuleHandler from './fixtures/ModuleHandler.svelte';

// `onclick={helpers.click}` — the handler is a function of another module, so it
// does not arrive as the namespace accessor's own wrapper: `$B.imported` holds a
// plain JavaScript object, and Brython's interop wraps the function again. That
// wrapper carries a `$function_infos` of its own with nothing in it but a name,
// which passes the guard and then trims to `undefined` — that is, not at all.
//
// The original is on `$js_func`, and it answers for the signature.
describe('a handler taken from another module', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(ModuleHandler, { target });
        flushSync();

        return {
            press: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            },
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent
        };
    };

    test('declaring no parameter is called with none', () => {
        const { press, read } = setup();

        press('none');
        press('refresh');

        expect(read('seen')).toBe('1');
    });

    test('and declaring one still receives the event', () => {
        const { press, read } = setup();

        press('one');
        press('refresh');

        expect(read('args')).toBe('1');
    });
});
