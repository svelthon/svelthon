// An operation taken off the type, and the list it is given at the call.
//
// `call_attr` already knows this rule: `list.append(rows, 1)` written in place
// finds its target in the first argument, which is what `onFirst` is for. An
// operation *kept as a value* — `add = list.append` — leaves that path, and the
// wrapper built when it was read has no target of its own: a bound method knows
// its instance, one taken off `list` does not.
//
// So `add(rows, 1)` mutated a watched list and told nobody, while the same call
// written through the type repainted. The witness is that second spelling.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import TypeMutator from './fixtures/TypeMutator.svelte';
import SuperMutator from './fixtures/SuperMutator.svelte';

// The same rule through `super()`: what changes is the instance, not the
// super object the method was found on. Called in place, kept as a value, or
// as a special method, on a list and on a dict.
test('a container changed through super() repaints what reads it', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(SuperMutator, { target });
    flushSync();
    const press = (key) => {
        target.querySelector(`button[data-k="${key}"]`).click();
        flushSync();
    };
    const read = (key) => target.querySelector(`[data-k="${key}"]`).textContent;

    press('push');
    expect(read('rows')).toBe('[1]');
    press('push-later');
    expect(read('rows')).toBe('[1, 2]');
    press('set-first');
    expect(read('rows')).toBe('[9, 2]');
    press('merge');
    expect(read('table')).toBe("{'answer': 42}");
});

describe.for([
    ['kept as a value', 'kept'],
    ['called through the type', 'direct']
])('an operation %s', ([, key]) => {
    test('repaints what reads its target', () => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(TypeMutator, { target });
        flushSync();

        const read = () => target.querySelector(`[data-k="${key}-total"]`).textContent;

        expect(read()).toBe('0');

        target.querySelector(`button[data-k="${key}"]`).click();
        flushSync();

        expect(read()).toBe('1');
    });
});

// And what Python still sees of the operation it asked for. A bare wrapper
// answered `JavascriptFunction` to `type(list.append)` and raised on
// `__objclass__`, while `list.copy` — the same shape, not a mutator, not adapted
// — answered `method_descriptor` and `list`. The witness is in the same line of
// output, so the two cannot drift apart.
describe('the adapted operation, seen from Python', () => {
    const read = (key) => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(TypeMutator, { target });
        flushSync();

        return target.querySelector(`[data-k="${key}"]`).textContent;
    };

    test('keeps its type', () => {
        expect(read('kind')).toBe("['method_descriptor', 'method_descriptor']");
    });

    test('and the class it belongs to', () => {
        expect(read('owner')).toBe("['list', 'list']");
    });
});
