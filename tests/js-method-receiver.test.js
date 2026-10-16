// **A method read off a JavaScript object stays bound to it**, as Python binds
// any method it reads, wherever Svelte calls it: a handler, an attachment, a
// transition. Svelte hands the same method the button, or nothing, which
// breaks `onclick={field.focus}`, `onclick={history.back}` and a class's
// `this.count += 1`; a handler that wants the element reads
// `event.currentTarget`. Decided against SOL188 F1, which asked for Svelte's.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import JsMethodReceiver from './fixtures/JsMethodReceiver.svelte';

test("a JavaScript object's method handed to Svelte runs on its object, as a Python method does", () => {
    const target = document.body.appendChild(document.createElement('div'));
    const called = [];
    const model = {
        handler() {
            called.push(['handler', this === model]);
        },
        fn(node) {
            called.push([node.dataset.k, this === model]);
            return { duration: 0 };
        }
    };
    const instance = mount(JsMethodReceiver, { target, props: { model } });

    flushSync();
    target.querySelector('button').click();
    instance.show();
    flushSync();

    expect(called).toEqual([
        ['attach', true],
        ['handler', true],
        ['transition', true]
    ]);
});
