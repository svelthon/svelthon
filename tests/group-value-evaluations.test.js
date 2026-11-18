import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupTicketsPy from './fixtures/GroupTicketsPy.svelte';
import GroupTicketsJs from './fixtures/GroupTicketsJs.svelte';
import { tickets } from './fixtures/group_tickets.js';

// A bind:group's value is evaluated as many times as Svelte's own group
// evaluates it, the field's and its own read that follows it: a value with a
// side effect, a ticket taken off a queue, leaves the queue where Svelte leaves
// it, at the install and once the box is ticked. Its value was evaluated once
// more at the install, and the next ticket was one further.
test('a value with a side effect is taken as often as Svelte takes it', () => {
    const run = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));

        tickets.reset();
        mount(Component, { target });
        flushSync();

        const box = target.querySelector('[data-k="box"]');
        const seen = [box.value, tickets.taken];

        box.click();
        flushSync();
        seen.push(target.querySelector('[data-k="picked"]').textContent, tickets.taken, tickets.next());
        target.remove();

        return seen;
    };

    expect(run(GroupTicketsPy)).toEqual(run(GroupTicketsJs));
});
