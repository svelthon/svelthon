import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import * as python from './fixtures/returned_function.py';
import * as native from './fixtures/returned_function.js';
import ReturnedFunction from './fixtures/ReturnedFunction.svelte';

// A JavaScript function a call returns is called from Python as an imported one
// is: its numbers and callbacks are converted, whichever way Python got hold of
// it. Going back out to JavaScript, it is the function itself again.
describe('a function a JavaScript call returns', () => {
    test('is called as the imported function is', () => {
        expect([python.direct(), python.returned(), python.member()]).toEqual([
            native.decimal(0.25),
            native.factory()(0.25),
            native.objectFactory().decimal(0.25)
        ]);
    });

    test('and is handed a Python callback it can call', () => {
        expect(python.called()).toBe(native.callbackFactory()(() => 7));
    });

    test('is one object however often it is returned', () => {
        expect(python.stable()).toBe(true);
    });

    test('goes back to JavaScript as itself', () => {
        expect(python.handed_back()).toBe(true);
        expect(python.handed_to_member()).toBe(true);
        expect(python.kept).toBe(native.decimal);
        expect(python.kept_marked).toBe(native.MARKED);
        expect(python.kept_marked.__.type).toBe('query');
    });

    test('and so through a component that hands it over', () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(ReturnedFunction, { target });
        flushSync();

        expect(instance.formatter()).toBe(native.decimal);
    });
});
