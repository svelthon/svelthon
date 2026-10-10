// The rest of a row in a pattern of the markup was JavaScript's: `...rest` by
// key, and by position `[first, ...others]`, which handed Python a JavaScript
// array and took its rest last or nowhere. In a template that is Python, where
// `{...attrs}` had long been `{**attrs}`, `...` is Python's Ellipsis.
//
// A target is Python's now: `**rest` takes the rest by key, a dict, as in a
// mapping pattern of a `match`; `*others` the rest by position, a list,
// wherever the star stands, as `first, *others = row` does, with Python's
// errors; and `...`, which nothing is assigned to, is refused as Python
// refuses it. CPython is the witness: `python3` gives each row below.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { createRequire } from 'node:module';
import { pythonExpressions, collector } from '../src/lib/markup.js';

// The engine, whose parser tells where an `{#await}` expression ends, as the
// plugin loads it before any markup is read. Through Node's own module cache,
// which a second evaluation of the engine in this environment would not share.
createRequire(import.meta.url)('../src/lib/compile.cjs');
import StarredRows from './fixtures/StarredRows.svelte';
import StarredShort from './fixtures/StarredShort.svelte';

const CPYTHON = {
    head: '1|[2, 3, 4]|list',
    tail: '[1, 2, 3]|4',
    middle: '1|[2, 3]|4',
    every: '[1, 2, 3, 4]',
    tuple: '1|[2, 3]',
    str: "a|['b', 'c']",
    dict: "x|['y']",
    array: '1|[2, 3]|list',
    nested: '1|2|[3, 4]',
    inner: '1|2|[3, 4]',
    keyed: '1|[2, 3, 4]',
    snippet: '5|[6, 7]',
    then: '1|[2, 3]',
    double: "1|{'y': 2}"
};

test('a starred name takes the rest by position, and a double star the rest by key', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(StarredRows, { target });
    flushSync();

    const found = Object.fromEntries([...target.querySelectorAll('p')].map((one) => [one.dataset.k, one.textContent]));

    expect(found).toEqual(CPYTHON);
    target.remove();
});

// `python3`: `first, *others, last = [1]` and `= 3`.
test.for([
    ['short', /ValueError: not enough values to unpack \(expected at least 2, got 1\)/],
    ['scalar', /TypeError: cannot unpack non-iterable int object/]
])('a %s row raises what Python raises', ([kind, error]) => {
    const target = document.body.appendChild(document.createElement('div'));

    expect(() => mount(StarredShort, { target, props: { kind } })).toThrow(error);
    target.remove();
});

const rewrite = (markup) =>
    pythonExpressions(markup, collector([]), undefined, { filename: 'Probe.svelte', content: markup, offset: 0 });

// Each refused with the position of its block, in Python's words where Python
// has some.
describe('a rest written where none can stand is refused', () => {
    test.for([
        ['`...` by key', '{#each rows as {id, ...rest}}{/each}', /cannot assign to Ellipsis/],
        ['`...` by position', '{#each rows as [first, ...others]}{/each}', /cannot assign to Ellipsis/],
        ['a bare `...`', '{#each rows as [first, ...]}{/each}', /cannot assign to Ellipsis/],
        ['`...` as the target of a key', '{#each rows as {id: ...}}{/each}', /cannot assign to Ellipsis/],
        ['`...` as the whole target', '{#each rows as ...}{/each}', /cannot assign to Ellipsis/],
        ['a star outside brackets', '{#each rows as *others}{/each}', /starred assignment target must be in a list or tuple/],
        ['a star as a parameter', '{#snippet row(*others)}{/snippet}', /starred assignment target must be in a list or tuple/],
        ['a star by key', '{#each rows as {id, *rest}}{/each}', /by key the rest is `\*\*rest`/],
        ['a double star by position', '{#each rows as [first, **rest]}{/each}', /by position the rest is `\*rest`/],
        ['two stars', '{#each rows as [*a, *b]}{/each}', /multiple starred expressions in assignment/],
        ['a double star not last', '{#each rows as {**rest, id}}{/each}', /stands last/],
        ['two double stars', '{#each rows as {**rest, **more}}{/each}', /stands last/],
        ['a double star on a pattern', '{#each rows as {id, **[a]}}{/each}', /`\*\*` takes a name/],
        ['a starred name with a default', '{#each rows as [first, *others=[]]}{/each}', /a rest takes no default/],
        ['`...` in `then`', '{#await p then {id, ...rest}}{/await}', /cannot assign to Ellipsis/]
    ])('%s', ([, markup, message]) => {
        expect(() => rewrite(markup)).toThrow(message);
        expect(() => rewrite(markup)).toThrow(/\(Probe\.svelte:1:1\)/);
    });

    // Python's Ellipsis is a value like any other where a value is read.
    test('and `...` as a default is the Ellipsis', () => {
        expect(() => rewrite('{#each rows as {id=...}}{id}{/each}')).not.toThrow();
    });
});
