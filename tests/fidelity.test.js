import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';

import Integers from './fixtures/Integers.svelte';
import Text from './fixtures/Text.svelte';
import Protocols from './fixtures/Protocols.svelte';
import Flow from './fixtures/Flow.svelte';
import Frames from './fixtures/Frames.svelte';
import Mutations from './fixtures/Mutations.svelte';
import Template from './fixtures/Template.svelte';
import Events from './fixtures/Events.svelte';
import Composition from './fixtures/Composition.svelte';
import Keyed from './fixtures/Keyed.svelte';
import Errors from './fixtures/Errors.svelte';
import InitError from './fixtures/InitError.svelte';
import OffsetError from './fixtures/OffsetError.svelte';

// Semantic fidelity grid.
//
// Every expected value was produced by CPython 3.12 running the component's
// Python as it stands (`python3 file.py`) — never written by hand. A codegen
// that optimises too far breaks these lines before anything else: dropping
// frames kills `Frames`, unboxing integers kills `Integers`, short-circuiting
// `augm_assign` kills `Protocols`.

function render(Component) {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    return target;
}

function report(Component) {
    const text = render(Component).querySelector('pre').textContent;
    return Object.fromEntries(
        text.split('\n').map((line) => {
            const cut = line.indexOf('=');
            return [line.slice(0, cut), line.slice(cut + 1)];
        })
    );
}

describe('integers — the unboxing canary', () => {
    test('arbitrary precision and floor division', () => {
        expect(report(Integers)).toEqual({
            big: '1180591620717411303424',
            mul: '9223372037000250000',
            floor: '-4',
            mod: '1',
            dm: '(-4, 1)',
            tdiv: '3.5',
            shift: '1267650600228229401496703205376',
            negpow: '-8',
            inexact: '0.30000000000000004'
        });
    });
});

describe('text — the string representation canary', () => {
    test('unicode, slices and the format mini-language', () => {
        expect(report(Text)).toEqual({
            emoji_len: '1',
            emoji_ord: '128512',
            rev: "'édcba'",
            last: "'l'",
            prec: "'3.14'",
            pad: "'   42'",
            sign: "'+7'",
            sharp: "'STRASSE'",
            joined: "'apple, apricot, banana'",
            mult: "'ababab'"
        });
    });
});

describe('protocols — the dispatch shortcut canary', () => {
    test('operators, descriptors and slots', () => {
        expect(report(Protocols)).toEqual({
            inplace: 'Acc(21)',
            plain: 'Acc(3)',
            radd: "'radd(1)'",
            prop: '42',
            fallback: "'missing:nope'",
            length: '3',
            item: '8',
            slots: "'AttributeError'"
        });
    });
});

describe('control flow', () => {
    test('generators, closures, finally and exception chaining', () => {
        const { leaked, leaked_in_func, kept, leaked_forms, ...rest } = report(Flow);

        expect(rest).toEqual({
            squares: '[0, 1, 4, 9]',
            genexp: '30',
            late: '[2, 2, 2]',
            nl: '2',
            ret: "'ret'",
            flow: "'try,finally'",
            cause: "'ZeroDivisionError'"
        });
    });

    // A Brython divergence, repaired in the vendored build: the iteration
    // variable stayed bound in the enclosing scope, where Python 3 gives the
    // comprehension a scope of its own. Both of these were `test.fails` until
    // the patch landed — see BRYTHON.md. They now guard it: lose the patch and
    // they go red.
    test('a comprehension variable does not leak, at module level', () => {
        expect(report(Flow).leaked).toBe('False');
    });

    test('nor inside a function', () => {
        expect(report(Flow).leaked_in_func).toBe('False');
    });

    test('and not from any comprehension form', () => {
        // A second list comprehension, a dict one, a set one, a generator
        // expression, and both levels of a nested one.
        expect(report(Flow).leaked_forms).toBe("''");
    });

    test('a name that existed before is handed back untouched', () => {
        expect(report(Flow).kept).toBe("'before'");
    });
});

describe('frames — the call-frame elision canary', () => {
    test('introspection and traceback depth', () => {
        expect(report(Frames)).toEqual({
            name: "'own_name'",
            caller: "'outer'",
            delta: '1',
            depth: '4',
            msg: "'deep'"
        });
    });
});

// Inside a Svelte template you are in JavaScript, not Python — and the two
// languages disagree. JS holds every object true, so `{#if}` on an empty list,
// an empty dict or None would say true where Python says false. The
// preprocessor rewrites conditions to Python's own bool().
describe('template — the Python/JavaScript boundary', () => {
    const cell = (k) => render(Template).querySelector(`[data-k="${k}"]`).textContent;

    test('empty values are false, as in Python', () => {
        expect(cell('empty')).toBe('false'); // []
        expect(cell('empty_dict')).toBe('false'); // {}
        expect(cell('none')).toBe('false'); // None
        expect(cell('zero')).toBe('false'); // 0
        expect(cell('text')).toBe('false'); // ""
        expect(cell('items')).toBe('true'); // ["a", "b", "c"]
    });

    test('the rewrite holds on {:else if} and nested {#if}', () => {
        expect(cell('elseif')).toBe('b');
        expect(cell('nested')).toBe('y');
    });

    test('{#each} iterates a Python list natively', () => {
        expect(cell('each')).toBe('abc');
    });

    test('py.str() renders values the Python way', () => {
        expect(cell('str_list')).toBe("['a', 'b', 'c']"); // JS would say "a,b,c"
        expect(cell('str_dict')).toBe("{'x': 1}"); // JS would say "[object Object]"
    });

    // The preprocessor wraps *text* interpolations in py.str().
    test('a bare interpolation already renders the Python way', () => {
        expect(cell('raw_list')).toBe("['a', 'b', 'c']");
        expect(cell('raw_dict')).toBe("{'x': 1}");
        expect(cell('raw_none')).toBe('None');
    });

    test('the rewrite survives braces and angle brackets', () => {
        expect(cell('brace')).toBe('a}b'); // '}' inside a string, not a closer
        expect(cell('gt')).toBe('inside a tag'); // '>' inside a quoted attribute
    });

    test('an attribute value keeps the value, not its rendering', () => {
        const el = render(Template).querySelector('[data-k="attr"]');
        expect(el.dataset.v).toBe('a,b,c'); // unwrapped: the list itself
    });
});

describe('composition — Python objects and child components', () => {
    const cell = (k) => render(Composition).querySelector(`[data-k="${k}"]`).textContent;

    test('dicts and tuples cross the template unaided', () => {
        expect(cell('dict')).toBe('[x|9]'); // keys exposed as JS properties
        expect(cell('tuple')).toBe('[k=1]'); // a tuple is a JS array
    });

    test('an instance’s attributes are readable from the template', () => {
        // Brython keeps attributes out of JS properties: in JavaScript,
        // {o.label} would render nothing. The expression is compiled as Python,
        // so it goes through Python's own attribute lookup.
        expect(cell('obj')).toBe('[a:1][b:2]');
    });

    test('and the descriptor protocol is honoured', () => {
        expect(cell('prop')).toBe('[2][4]'); // a @property, not an attribute
    });

    test('a Python object passes as a prop to a child component', () => {
        expect(cell('child')).toBe('>a=1>b=2'); // prefix left at its default
        expect(cell('child_prop')).toBe('-a=1-b=2');
    });
});

// A keyed `{#each}` is where the identity of Python objects really counts: the
// copy publish() used to make must not break reconciliation.
describe('keyed {#each}', () => {
    const setup = () => {
        const target = render(Keyed);
        return {
            target,
            list: () =>
                [...target.querySelectorAll('[data-k="list"] li')]
                    .map((n) => `${n.dataset.id}:${n.textContent}`)
                    .join(','),
            node: (id) => target.querySelector(`li[data-id="${id}"]`),
            click: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('insertion and removal reconcile on the Python key', () => {
        const { list, node, click } = setup();
        const kept = node(2);

        expect(list()).toBe('1:a,2:b');

        click('prepend');
        expect(list()).toBe('3:c,1:a,2:b');
        expect(node(2)).toBe(kept); // node reused, not recreated

        click('drop_first');
        expect(list()).toBe('1:a,2:b');
        expect(node(2)).toBe(kept);
    });

    test('a Python tuple destructures inside the {#each}', () => {
        const { target } = setup();

        // `as (rank, it)`: Python's syntax, translated into JavaScript
        // destructuring — a tuple *is* an array. Not to be confused with
        // `as it, i`, which is Svelte's index.
        expect(
            [...target.querySelector('[data-k="pairs"]').children].map((n) => n.textContent).join('|')
        ).toBe('0:a|1:b');
    });

    test('mutating an item’s attribute re-renders', () => {
        const { list, click } = setup();

        // The item keeps its identity, so Svelte would re-render nothing: it is
        // {#each} that passes the mark to the rows, and follow() on the block
        // variable that subscribes the row's block to the row itself.
        click('relabel'); // it.label = it.label.upper()
        expect(list()).toBe('1:a,2:B');
    });

    test('replacing the item re-renders, and keeps the node', () => {
        const { list, node, click } = setup();
        const kept = node(2);

        click('replace'); // items[i] = Item(it.id, ...)
        expect(list()).toBe('1:a,2:B');
        expect(node(2)).toBe(kept); // the key has not changed
    });
});

// A Brython exception reaches JavaScript with neither `message` nor `stack`:
// devtools and Vite's overlay would show nothing. The text does exist, inside
// the Python object, where nothing in JS goes looking for it.
describe('Python errors', () => {
    test('an uncaught exception is readable from JavaScript', () => {
        const target = render(Errors);
        let captured = null;
        window.addEventListener('error', (ev) => (captured = ev), { once: true });

        target.querySelector('button[data-k="boom"]').click();
        flushSync();

        expect(captured).not.toBeNull();
        // The line comes from the Python traceback, realigned on the file.
        expect(captured.error.message).toBe(
            'ValueError: broken at the bottom (boom() — tests/fixtures/Errors.svelte:6)'
        );
        expect(captured.error.stack).toContain('boom() — tests/fixtures/Errors.svelte:6');
    });

    test('the component survives an exception', () => {
        const target = render(Errors);
        window.addEventListener('error', () => {}, { once: true });

        target.querySelector('button[data-k="boom"]').click();
        flushSync();
        target.querySelector('button[data-k="works"]').click();
        flushSync();

        expect(target.querySelector('p[data-k="count"]').textContent).toBe('1');
    });

    test('a Python try/except stays a Python try/except', () => {
        const target = render(Errors);

        target.querySelector('button[data-k="caught"]').click();
        flushSync();

        expect(target.querySelector('p[data-k="message"]').textContent).toBe(
            'ValueError: broken at the bottom'
        );
    });

    test('the line stays right when another script precedes the Python', () => {
        const target = render(OffsetError);
        let captured = null;
        window.addEventListener('error', (ev) => (captured = ev), { once: true });

        target.querySelector('button[data-k="boom"]').click();
        flushSync();

        expect(captured.error.message).toBe(
            "KeyError: 'shifted' (boom() — tests/fixtures/OffsetError.svelte:11)"
        );
    });

    test('an error in the module body names the file', () => {
        expect(() => render(InitError)).toThrow(/ZeroDivisionError.*InitError\.svelte/);
    });
});

describe('events — the boundary with the DOM', () => {
    // The value used to be pulled out of the event by a JavaScript arrow in the
    // markup. Handlers are Python now, and reading a DOM node's attributes from
    // Python needs `from browser import html`, which jsdom cannot import — so
    // what is checked here is that a handler's argument reaches Python, and the
    // DOM read itself is covered in a real browser.
    test('a value handed to a handler arrives in Python', () => {
        const target = render(Events);
        const input = target.querySelector('input');

        input.value = 'hello';
        input.dispatchEvent(new window.Event('input', { bubbles: true })); // Svelte delegates
        flushSync();

        expect(target.querySelector('p[data-k="typed"]').textContent).toBe('TYPED');
    });

    test('a handler declaring a parameter receives the wrapped event', () => {
        const target = render(Events);

        target.querySelector('button').click();
        flushSync();

        expect(target.querySelector('p[data-k="kind"]').textContent).toBe('DOMEvent');
    });
});

// This block does not test Python but Svelthon itself: which Python writes
// trigger a render. One signal per module name ⇒ it is *rebinding* a name that
// is reactive, never mutating a value in place.
describe('reactivity — which Python writes propagate', () => {
    const setup = () => {
        const target = render(Mutations);
        const read = (k) => target.querySelector(`p[data-k="${k}"]`).textContent;
        const click = (k) => {
            target.querySelector(`button[data-k="${k}"]`).click();
            flushSync();
        };
        return { read, click };
    };

    test('rebinding a name propagates', () => {
        const { read, click } = setup();

        expect(read('count')).toBe('0');
        click('rebind');
        expect(read('count')).toBe('1');
        click('augment'); // `global count; count += 10` is a rebinding too
        expect(read('count')).toBe('11');
    });

    test('rebinding a list propagates', () => {
        const { read, click } = setup();

        const before = read('items');
        click('rebind_list');
        expect(read('items')).not.toBe(before);
    });

    test('mutating a list in place propagates', () => {
        const { read, click } = setup();

        expect(read('items')).toBe('[]');
        click('mutate_list');
        expect(read('items')).toBe('[0]');
    });

    test('mutating a dict in place propagates, and so does del', () => {
        const { read, click } = setup();

        expect(read('table')).toBe('{}');
        click('mutate_dict');
        expect(read('table')).toBe("{'k': 0}");
        click('drop_key');
        expect(read('table')).toBe('{}');
    });

    test('mutating a set in place propagates', () => {
        const { read, click } = setup();

        expect(read('tags')).toBe('set()');
        click('mutate_set');
        expect(read('tags')).toBe('{0}');
    });

    // The point compile-time detection could never hold: the mark is carried by
    // the object, not by the call site.
    test('a third-party function mutating the list propagates too', () => {
        const { read, click } = setup();

        click('through_helper');
        expect(read('items')).toBe("['helper']");
    });

    test('a @derived returning the mutated object propagates too', () => {
        const { read, click } = setup();

        expect(read('passthrough')).toBe('[]');
        expect(read('computed')).toBe('0');

        click('mutate_list');

        // The derived returns the same array: its value does not change in the
        // === sense, and Svelte would stop there. It is the object itself that
        // subscribes its reader, through the mark it carries.
        expect(read('passthrough')).toBe('[0]');
        expect(read('computed')).toBe('1');
    });

    test('deleting an attribute propagates', () => {
        const { read, click } = setup();

        expect(read('extra')).toBe('True');
        click('drop_attribute');
        expect(read('extra')).toBe('False');
    });

    test('a container held in an attribute propagates', () => {
        const { read, click } = setup();

        // Set in __init__, so *before* the object came under guard: it is the
        // marking of the object that passes it on to its attributes.
        expect(read('rows')).toBe('[]');
        click('add_row');
        expect(read('rows')).toBe('[0]');
    });

    // Safety: what must never be marked.
    test('None is never marked', () => {
        setup();

        // It is a singleton shared by the whole program: hanging subscribers on
        // it would grow it without end, and across every component.
        expect(globalThis.__BRYTHON__.builtins.None.$notify).toBeUndefined();
    });

    test('a class stored in a state name stays usable', () => {
        expect(setup().read('alias')).toBe('Box');
    });

    // The limitations that remain, held by tests so they cannot drift in
    // silence.
    test('a nested container propagates', () => {
        const { read, click } = setup();

        // The inner list is marked the moment Python reads it — so just before
        // it could be mutated.
        click('mutate_nested');
        expect(read('nested')).toBe("{'rows': [1]}");
    });

    test('including one only reached through .items()', () => {
        const { read, click } = setup();

        // .items() returns the children without ever indexing them. A Brython
        // dict exposes its keys as JavaScript properties, so the guard is
        // passed on without materialising the view.
        click('mutate_via_items');
        expect(read('nested')).toBe("{'rows': [2]}");
    });

    test('and through .values()', () => {
        const { read, click } = setup();

        click('mutate_via_values');
        expect(read('nested')).toBe("{'rows': [3]}");
    });

    test('mutating an instance attribute propagates', () => {
        const { read, click } = setup();

        click('mutate_attribute');
        expect(read('attr')).toBe('1');
    });
});
