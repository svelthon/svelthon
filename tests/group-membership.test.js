// **A checkbox shows what the group's model says of its value with `in`**, as
// Svelte's group asks its array `includes`. The box looked for an equal item
// itself, so a selection whose class defines `__contains__`, comparing without
// case, always yes or always no, showed the opposite of what `"yes" in picked`
// answers. A plain list is the control.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
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
)('%s: a selection whose rule is %s shows the box checked %s', ([language, rule, checked]) => {
    const Component = language === 'Python' ? GroupMembership : GroupMembershipNative;
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target, props: { rule } });
    flushSync();

    expect(target.querySelector('input').checked).toBe(checked);
});
