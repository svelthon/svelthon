// @vitest-environment node
//
// The server half of `group-same-object.test.js`: an object the model already
// holds is served checked in both of its boxes, even when its `==` says no to
// itself, as Svelte's server serves its own.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import GroupSameObject from './fixtures/GroupSameObject.svelte';
import GroupSameObjectNative from './fixtures/GroupSameObjectNative.svelte';

test.for([
    ['Python', GroupSameObject],
    ['Svelte', GroupSameObjectNative]
])('%s: an object the model holds is served checked in both boxes', ([, Component]) => {
    const { body } = render(Component, { props: { initial: true } });

    expect(body.match(/<input[^>]*\schecked/g)).toHaveLength(2);
});
