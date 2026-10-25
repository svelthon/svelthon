// **A tag a capital starts that holds a dash is an element**, as Svelte reads
// it: its `regex_valid_component_name` takes a component's name whole, and a
// dash is no character of one. Read off its first letter, `<Dashed-Tag>` was a
// component, its name the Python expression `Dashed - Tag`, and the render
// failed with `NameError: name 'Dashed' is not defined`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import DashedTags from './fixtures/DashedTags.svelte';

test('a tag a capital starts that holds a dash renders as the element it is', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(DashedTags, { target });
    flushSync();

    const read = () =>
        ['first', 'parts', 'upper', 'long'].map((key) => {
            const element = target.querySelector(`[data-k="${key}"]`);

            return [element.localName, element.title, element.textContent];
        });
    const before = read();

    instance.retitle();
    flushSync();

    expect(before).toEqual([
        ['dashed-tag', 'before', 'ok'],
        ['dashed-tag', 'before', 'ok'],
        ['dashed-tag', 'before', 'ok'],
        ['dashed-long-tag', 'before', 'ok']
    ]);
    expect(read().map(([, title]) => title)).toEqual(['after', 'after', 'after', 'after']);
});
