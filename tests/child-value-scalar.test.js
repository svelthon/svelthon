// **A component written in JavaScript is handed JavaScript's scalar for
// `value`, as for any other prop**, whether written `value={…}` or bound. The
// box a binding of an element compares with (`compared`) reached it: a
// `Price(0.5)` arrived as an object, and a NaN failed `Number.isNaN`, where
// another prop holding the same value arrived as the number.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ChildValueHost from './fixtures/ChildValueHost.svelte';
import ChildValueHostNative from './fixtures/ChildValueHostNative.svelte';

test.for(
    ['Python', 'Svelte'].flatMap((language) =>
        [
            ['nan', 'NaN'],
            ['price', 'number'],
            ['count', 'number'],
            ['label', 'string']
        ].map(([kind, seen]) => [language, kind, seen])
    )
)('%s: a %s handed to a JavaScript child arrives as %s', ([language, kind, seen]) => {
    const Component = language === 'Python' ? ChildValueHost : ChildValueHostNative;
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target, props: { kind } });
    flushSync();

    expect([...target.querySelectorAll('p')].map((one) => one.textContent)).toEqual([`${seen}|${seen}`, `${seen}|${seen}`]);
});
