// **`{@debug}` logs what the template reads, as Python reads it.** The tag was
// handed to Svelte as it was written: a name Python reads under another
// spelling, `ﬁeld` for `field`, was a JavaScript name nothing declared, and the
// component did not mount; and a list or a dict changed in place was logged
// once, since the cell under its name does not change when what it holds does.
// A name in parentheses was both again, and one given twice was declared twice.
//
// The witness is the same markup in Svelte: what it logs, under which name, at
// each change, and the page around the tags, whose whitespace Svelte trims
// beside a tag that renders nothing.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import DebugTags from './fixtures/DebugTags.svelte';
import DebugTagsNative from './fixtures/DebugTagsNative.svelte';
import DebugTagRuns from './fixtures/DebugTagRuns.svelte';
import DebugTagRunsNative from './fixtures/DebugTagRunsNative.svelte';

const logged = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    const seen = [];
    const original = console.log;

    // Svelte logs each tag as one object, its names for keys: what a list or
    // a dict holds is read off it as JSON.
    console.log = (...args) => {
        if (args.length === 1 && args[0] !== null && typeof args[0] === 'object') seen.push(JSON.stringify(args[0]));
    };

    try {
        const instance = mount(Component, { target });

        flushSync();
        instance.change();
        flushSync();

        return { logged: seen, page: target.innerHTML.replace(/<!--[^>]*-->/g, '') };
    } finally {
        console.log = original;
        target.remove();
    }
};

test('{@debug} logs and leaves the page as in Svelte, a change in place and a name Python spells otherwise included', () => {
    const native = logged(DebugTagsNative);

    expect(logged(DebugTags)).toEqual(native);
    expect(native.logged).toContain('{"rows":[1]}');
    expect(native.logged).toContain('{"ﬁeld":2}');
    expect(native.logged).toContain('{"record":{"n":1},"total":1}');
});

// Svelte reads the whitespace between the tags of a run as texts side by side, and
// keeps every other one: two tags in a line of text leave two spaces, which the
// rewriting into blocks made one by holding them all for the last tag.
test('a run of {@debug} leaves the whitespace Svelte leaves', () => {
    const page = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        const log = console.log;

        console.log = () => {};
        try {
            mount(Component, { target });
            flushSync();

            return target.innerHTML.replace(/<!--[^>]*-->/g, '');
        } finally {
            console.log = log;
            target.remove();
        }
    };
    const native = page(DebugTagRunsNative);

    expect(page(DebugTagRuns)).toBe(native);
    expect(native).toContain('<p data-k="2">A  B</p>');
});
