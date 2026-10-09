// A memoryview shows its buffer as it is now, whichever way the buffer
// changed: written directly, through another view, or reversed in place. A
// view was watched apart from its buffer, so only a write through the view
// itself repainted it; the model read `120,98` and the page `97,98`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BufferView from './fixtures/BufferView.svelte';

test.for(['buffer', 'another view', 'reverse', 'the view', 'tail'])(
    'a memoryview repaints when its buffer changes, through %s',
    (how) => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(BufferView, { target });

        flushSync();
        instance.change(how);
        flushSync();

        const page = target.querySelector('p').textContent;

        expect(page).not.toBe('97,98|98');
        expect(page).toBe(instance.held());
    }
);
