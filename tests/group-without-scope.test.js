// `group` is the action a `bind:group` compiles to, and the compiler always
// hands it the component's namespace as the scope the boxes share a token
// through. Called without one, it makes a token of its own rather than writing
// a property onto the binding's text, which is a string.
import { test, expect } from 'vitest';
import { group } from '../src/lib/runtime.js';

test('a group action with no scope mounts', () => {
    const node = document.body.appendChild(document.createElement('input'));
    node.type = 'checkbox';
    node.value = 'a';

    let chosen = [];
    const current = () => chosen;
    const write = (value) => {
        chosen = value;
    };

    expect(() => group(node, [current, write, undefined, '"picked"', undefined])).not.toThrow();

    node.remove();
});
