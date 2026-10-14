// @vitest-environment node
//
// The server half of `child-value-scalar.test.js`: a component written in
// JavaScript is handed JavaScript's scalar for `value` on a server too.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
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
)('%s: a %s handed to a JavaScript child arrives as %s, on a server', ([language, kind, seen]) => {
    const Component = language === 'Python' ? ChildValueHost : ChildValueHostNative;
    const { body } = render(Component, { props: { kind } });

    expect(body.match(/<p>[^<]*<\/p>/g)).toEqual([`<p>${seen}|${seen}</p>`, `<p>${seen}|${seen}</p>`]);
});
