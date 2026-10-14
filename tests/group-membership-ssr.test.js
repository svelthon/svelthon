// @vitest-environment node
//
// The server half of `group-membership.test.js`: the `checked` a server writes
// for a checkbox is what the model says of its value with `in`, as Svelte's
// server asks its array `includes`.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import GroupMembership from './fixtures/GroupMembership.svelte';
import GroupMembershipNative from './fixtures/GroupMembershipNative.svelte';

test.for(
    ['Python', 'Svelte'].flatMap((language) =>
        [
            ['fold', true],
            ['always', true],
            ['never', false],
            ['plain', true]
        ].map(([rule, checked]) => [language, rule, checked])
    )
)('%s: a selection whose rule is %s is served checked %s', ([language, rule, checked]) => {
    const Component = language === 'Python' ? GroupMembership : GroupMembershipNative;
    const { body } = render(Component, { props: { rule } });

    expect(/<input[^>]*\schecked/.test(body)).toBe(checked);
});
