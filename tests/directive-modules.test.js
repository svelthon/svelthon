import { test, expect, describe } from 'vitest';
import { mount, unmount, flushSync, settled } from './mounted.js';
import { pythonExpressions, collector } from '../src/lib/markup.js';
import { directiveTransition } from '../src/lib/runtime.js';
import DirectiveModule from './fixtures/DirectiveModule.svelte';
import DirectiveLife from './fixtures/DirectiveLife.svelte';
import DirectiveScope from './fixtures/DirectiveScope.svelte';

// A directive's *value* has been Python for a long time. Its *name* had not:
// Svelte copies that text into a `() => …` of its own, so `in:fades.typewriter`
// looks for a JavaScript `fades`, and `import fades` binds in Python's namespace
// instead. Nothing said so — an intro transition is skipped on first render, so
// the element mounted, the text appeared whole, and the lesson never ran.
//
// Three passes renamed or bound the head by where its name came from, and each
// left a place out: an alias, a local cell, a name the markup declared, an
// export that changes. The head is a Python expression now, compiled where it is
// written, and Svelte calls the runtime's adapter with it and the value.
const rewrite = (markup) =>
    pythonExpressions(markup, collector([]), undefined, {
        filename: 'Probe.svelte',
        content: markup,
        offset: 0
    });

describe('a directive that names a function', () => {
    test('hands its head and value to the adapter of its kind', () => {
        expect(rewrite('<p use:a.act={v} in:b.fade out:c.fade transition:d.fade|global>x</p>')).toMatch(
            /^<p use:__directiveAction=\{\["a\.act", \(\) => __expr_py_\d+\(\), __expr_py_\d+\(\)\]\} in:__directiveTransition=\{\["b\.fade", \(\) => __expr_py_\d+\(\)\]\} out:__directiveTransition=\{\["c\.fade", \(\) => __expr_py_\d+\(\)\]\} transition:__directiveTransition\|global=\{\["d\.fade", \(\) => __expr_py_\d+\(\)\]\}>x<\/p>$/
        );
    });

    test('and inside a keyed block, where animate: belongs', () => {
        expect(rewrite('{#each xs as x (x)}<p animate:moves.flip>x</p>{/each}')).toContain(
            'animate:__directiveAnimate={["moves.flip", '
        );
    });

    // One interpolation between quotes is the value, as Svelte reads it.
    test('with its value braced or quoted', () => {
        expect(rewrite('<p use:act="{v}">x</p>')).toMatch(/use:__directiveAction=\{\["act", \(\) => __expr_py_\d+\(\), __expr_py_\d+\(\)\]\}>/);
    });

    // An attribute may follow a quote with no space, and Svelte reads it.
    test('straight after a quoted attribute', () => {
        expect(rewrite('<p title="note"use:act>x</p>')).toContain('"note"use:__directiveAction=');
    });

    // Whitespace around `=`, which HTML allows and Svelte reads: the value was
    // left behind and assigned a second time.
    test.for(['use:act ={v}', 'use:act= {v}', 'use:act = {v}', 'use:act\n=\n{v}', 'use:act = "{v}"'])(
        'with whitespace around the equals sign: %s',
        (attribute) => {
            expect(rewrite(`<p ${attribute}>x</p>`)).toMatch(
                /^<p use:__directiveAction=\{\["act", \(\) => __expr_py_\d+\(\), __expr_py_\d+\(\)\]\}>x<\/p>$/
            );
        }
    );

    // `class:` names a class, `style:` a property, `bind:` a target.
    test('but not the directives that name something else', () => {
        expect(rewrite('<p class:a={b} style:c="d">x</p>')).not.toContain('__directive');
    });
});

describe('a directive naming a module', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(DirectiveModule, { target });
        flushSync();
        return (k) => target.querySelector(`p[data-k="${k}"]`).textContent;
    };

    test('runs the action it names', () => expect(setup()('acted')).toBe('acted'));

    test('and runs it with a value too', () => expect(setup()('valued')).toBe('acted'));

    // An `async def` is started, as a handler's is, not flattened into an
    // empty object Svelte then ignores.
    test('and runs an action written as a coroutine', async () => {
        const at = setup();
        await settled(() => expect(at('async')).toBe('started'));
    });

    // And the value arrives as Python.
    //
    // An action is called by Svelte, with Svelte's values, and both wrappers —
    // the module's and the component's own — trimmed the arguments to the arity
    // and handed them over raw. So `use:mark={0.5}` gave Python a JavaScript
    // number, `format(value, '.2f')` answered *non-empty format string passed to
    // object.__format__*, and the component failed at mount.
    //
    // An integer beside it is why it went unseen for so long: 1 and 0.5 are the
    // same kind of value to JavaScript and two different things to Brython, so
    // an action that only ever took whole numbers worked.
    test.for([
        ['from a module', 'module'],
        ['written in the component', 'local']
    ])('a fractional parameter reaches an action %s', ([, which]) => {
        const read = setup();

        expect(read(`${which}-half`)).toBe('0.50');
        expect(read(`${which}-whole`)).toBe('1.00');
    });

    // Reached through the name an import binds, or through an object of the
    // module. An alias and an imported member had no JavaScript binding and
    // the component died at mount; an instance's method was not a JavaScript
    // property, so the action never ran; a dict's function was handed over
    // unadapted, and `0.5` reached `format` as a JavaScript number.
    test.for([
        'alias',
        'member',
        'member-alias',
        'instance',
        'registry',
        'local-alias',
        'local-registry',
        'local-instance',
        'local-callable'
    ])(
        'and through %s',
        (key) => {
            expect(setup()(key)).toBe('0.50');
        }
    );
});

describe('a directive reaching further', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(DirectiveLife, { target });
        flushSync();

        return { instance, at: (k) => target.querySelector(`[data-k="${k}"]`) };
    };

    // `import *` binds names the compiler cannot list: the directive had no
    // JavaScript name and the component died at mount.
    test('finds a name an import * bound', () => {
        expect(setup().at('star').textContent).toBe('0.50');
    });

    // A JavaScript record with an `ob_type` field is data. It was taken for a
    // Python object, the engine read the string as a class, and the mount
    // failed; its method keeps JavaScript's own number.
    test('and leaves a JavaScript record its own', () => {
        expect(setup().at('record').textContent).toBe('0.50');
    });

    // An action may hand back an instance whose methods Svelte calls. They live
    // on its class, which a walk of its own properties never finds: the
    // parameter changed and the element did not, and nothing was cleaned up.
    test('and calls update on an instance an action returned', () => {
        const { at } = setup();

        at('bump').click();
        flushSync();

        expect(at('lease').textContent).toBe('0.75');
    });

    test('and destroy, when the component goes', () => {
        const { instance, at } = setup();
        const lease = at('lease');

        unmount(instance);
        flushSync();

        expect(lease.dataset.cleanup).toBe('done');
    });
});

// The boundary itself, called the way Svelte calls it rather than through a
// transition: both halves of what broke are here, and each failed on its own.
describe('a directive whose callee is', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(DirectiveScope, { target });
        flushSync();

        return (k) => target.querySelector(`[data-k="${k}"]`);
    };

    // A name the markup declared holds a Python value, and Svelte called it
    // raw: a fractional value reached `format` as a JavaScript number, and a
    // bound method was not a function at all.
    test.for([
        ['a loop variable', 'each'],
        ['a loop variable holding a bound method', 'method'],
        ['a template declaration', 'declared'],
        ['a snippet parameter', 'snippet']
    ])('%s is called with Python values', ([, key]) => {
        expect(setup()(key).textContent).toBe('0.50');
    });

    // The value keeps its Python shape for a Python callee, and is converted at
    // every depth for a JavaScript one: one copy converted on its first level
    // served neither.
    test('a Python function given a dict of floats', () => {
        expect(setup()('python-options').textContent).toBe('0.50/0.25');
    });

    test('a JavaScript function given nested options', () => {
        expect(setup()('js-options').textContent).toBe('0.50/0.25');
    });

    // What the JavaScript action handed back is its own bare function, which
    // Svelte calls with the value again: converted there too.
    test('and its update, given the next options', () => {
        const at = setup();

        at('grow').click();
        flushSync();

        expect(at('js-options').textContent).toBe('0.75/0.13');
    });

    // A JavaScript action may hand back an instance whose methods read `this`:
    // Svelte calls them on it, and so must the adapter.
    test('a JavaScript action handing back an instance', () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(DirectiveScope, { target });
        flushSync();

        const lease = target.querySelector('[data-k="lease"]');
        expect(lease.textContent).toBe('0.50');

        target.querySelector('[data-k="renew"]').click();
        flushSync();
        expect(lease.textContent).toBe('0.75');

        unmount(instance);
        flushSync();
        expect(lease.dataset.cleanup).toBe('done');
    });

    // The callee is read when the action is installed and is no dependency of
    // its value: a new callee did not call `update` with the old value, nor an
    // action written without one. A new value still does, once.
    test('an action whose callee changes is not updated, and one whose value does is', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(DirectiveScope, { target });
        flushSync();

        const at = (k) => target.querySelector(`[data-k="${k}"]`);

        at('swap-action').click();
        flushSync();

        expect(at('counted').dataset).toMatchObject({ action: 'first', updates: '0' });
        expect(at('counted-bare').dataset).toMatchObject({ action: 'first', updates: '0' });

        at('move').click();
        flushSync();

        expect(at('counted').dataset.updates).toBe('1');
        expect(at('counted-bare').dataset.updates).toBe('0');

        // Recomputed and equal, `True` both times: Svelte's own comparison
        // does not update, and the payload, a new array each time, always
        // looked changed to it.
        expect(at('counted-same').dataset.updates).toBe('0');
    });

    // Svelte calls an action optionally: an absent one installs nothing.
    test('an action that is None installs nothing', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(DirectiveScope, { target });
        flushSync();

        expect(target.querySelector('[data-k="maybe"]').textContent).toBe('not yet');
    });

    // A JavaScript export is read when the directive runs: one captured at
    // initialisation kept the function the module had since replaced.
    test('a JavaScript export the module replaced', () => {
        const at = setup();

        expect(at('live').textContent).toBe('first');

        at('swap').click();
        flushSync();
        at('show').click();
        flushSync();

        expect(at('live').textContent).toBe('second');
    });
});

// Svelte's protocol around the payload, one row per case, called the way Svelte
// calls the adapter. The payload is never absent, so Svelte's own defaults and
// conventions apply to nothing unless the adapter applies them.
describe("Svelte's protocol, kept around the payload", () => {
    const python = () => globalThis.__BRYTHON__.imported.directive_mod;
    const node = () => document.createElement('p');

    // `transition:` is called with `params ?? {}`.
    test.for([
        ['absent', []],
        ['None', [globalThis.__BRYTHON__?.builtins.None]]
    ])('a transition given a value %s gets an empty one', async ([, value]) => {
        const { defaults } = await import('./fixtures/directive_live.js');
        mount(DirectiveModule, { target: document.body.appendChild(document.createElement('div')) });

        const js = node();
        directiveTransition(js, ['defaults', () => defaults, ...value], { direction: 'in' });
        expect(js.textContent).toBe('0.50');

        const py = node();
        directiveTransition(py, ['with_params', () => python().with_params, ...value], { direction: 'in' });
        expect(py.textContent).toBe('0.50');
    });

    // An optional callback written as None is absent: Svelte asks `if (tick)`,
    // and `None` is an object, so it was a callback to call.
    test.for(['nullable', 'nullable_instance', 'nullable_deferred'])('None callbacks are absent, %s', (key) => {
        mount(DirectiveModule, { target: document.body.appendChild(document.createElement('div')) });

        const result = directiveTransition(node(), [key, () => python()[key]], { direction: 'in' });
        const config = typeof result === 'function' ? result({ direction: 'in' }) : result;

        expect(config.duration).toBe(0.5);
        expect(config.css ?? null).toBe(null);
        expect(config.tick ?? null).toBe(null);
    });

    // A transition may hand back a function Svelte calls later for the
    // config: a Python one, or a callable instance, is a callable like any
    // other, and its config is converted like an immediate one.
    test.for(['deferred', 'deferred_instance'])('a deferred transition, %s', (key) => {
        mount(DirectiveModule, { target: document.body.appendChild(document.createElement('div')) });

        const at = node();
        const later = directiveTransition(at, [key, () => python()[key]], { direction: 'in' });

        expect(typeof later).toBe('function');

        const config = later({ direction: 'in' });

        expect(config.duration).toBe(0.5);
        expect(config.easing(0.5)).toBe(0.25);

        config.tick(0.25, 0.75);
        expect(at.textContent).toBe('0.25/0.75');
    });
});

describe('what a module member becomes for Svelte', () => {
    // Called the way Svelte calls `in:directive_mod.typewriter`: the adapter,
    // with the payload the markup pass wrote.
    const transition = (node, options) => {
        mount(DirectiveModule, { target: document.body.appendChild(document.createElement('div')) });
        flushSync();

        const typewriter = globalThis.__BRYTHON__.imported.directive_mod.typewriter;

        return directiveTransition(node, ['directive_mod.typewriter', () => typewriter], options);
    };

    // Svelte hands a transition three arguments; the Python signature declares
    // two, and Python refuses the extra one rather than ignoring it.
    test('takes the arguments Svelte passes, trimmed to what Python declared', () => {
        const node = document.createElement('p');
        node.textContent = 'abcd';

        expect(transition(node, { direction: 'in' }).duration).toBe(4);
    });

    // And the config comes back readable from JavaScript: Svelte reads
    // `.duration` and calls `.tick` itself, with fractions.
    test('and hands back a config JavaScript can read and call', () => {
        const node = document.createElement('p');
        node.textContent = 'abcd';

        const config = transition(node, {});

        expect(typeof config.tick).toBe('function');

        config.tick(0.5, 0.5);
        expect(node.textContent).toBe('ab');
    });
});
