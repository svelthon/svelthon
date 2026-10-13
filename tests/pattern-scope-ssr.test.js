// @vitest-environment node
//
// The server half of `pattern-scope.test.js`: a default reading a name a row
// before it unpacks, by key or around a star, renders on a server as in a
// browser, where it raised `Cannot access 'first' before initialization`.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import PatternScope from './fixtures/PatternScope.svelte';
import PatternScopeNative from './fixtures/PatternScopeNative.svelte';

test.for([
    ['Python', PatternScope],
    ['Svelte', PatternScopeNative]
])('%s: a default may read a name a row before it unpacks, on a server', ([, Component]) => {
    const { body } = render(Component);

    for (const one of [
        'unpacked">1:1<',
        'unpacked-spelling">1:1<',
        'unpacked-pattern">1:1<',
        'snippet-unpacked">1:1<',
        'snippet-starred">1:2<'
    ]) {
        expect(body).toContain(`data-k="${one}`);
    }
});
