import { test, expect, describe } from 'vitest';
import { mount, unmount, flushSync, settled } from './mounted.js';
import { pythonExpressions, collector } from '../src/lib/markup.js';
import { pyModule } from '../src/lib/runtime.js';
import DirectiveModule from './fixtures/DirectiveModule.svelte';
import DirectiveLife from './fixtures/DirectiveLife.svelte';

const { compile } = await import('../src/lib/compile.cjs').then((m) => m.default ?? m);

// A directive's *value* has been Python for a long time. Its *name* had not:
// Svelte copies that text into a `() => …` of its own, so `in:fades.typewriter`
// looks for a JavaScript `fades`, and `import fades` binds in Python's namespace
// instead. Nothing said so — an intro transition is skipped on first render, so
// the element mounted, the text appeared whole, and the lesson never ran.
// The markup pass renames each head it does not declare itself, and hands the
// compiler the pairs.
const rename = (markup) => {
    const directives = [];
    const out = pythonExpressions(markup, collector([]), undefined, {
        filename: 'Probe.svelte',
        content: markup,
        offset: 0,
        directives
    });

    return { out, heads: directives.map((one) => one.head) };
};

describe('the head of a directive', () => {
    test('is renamed for each directive that names a function', () => {
        const { out, heads } = rename('<p use:a.act in:b.fade out:c.fade transition:d.fade>x</p>');

        expect(heads).toEqual(['a', 'b', 'c', 'd']);
        expect(out).toBe(
            '<p use:__dir_a.act in:__dir_b.fade out:__dir_c.fade transition:__dir_d.fade>x</p>'
        );
    });

    test('and inside a keyed block, where animate: belongs', () => {
        expect(rename('{#each xs as x (x)}<p animate:moves.flip>x</p>{/each}').heads).toEqual(['moves']);
    });

    // `class:` names a class, `style:` a property, `bind:` a target. A dot means
    // something else in all three.
    test('but not of the directives that name something else', () => {
        expect(rename('<p class:a.b style:c.d bind:e.f>x</p>').heads).toEqual([]);
    });

    // `from m import mark` binds `mark` in Python alone, and `chosen =
    // measured` holds a Python value in its cell.
    test('and of an undotted one', () => {
        expect(rename('<p transition:fly use:mark>x</p>').heads).toEqual(['fly', 'mark']);
    });

    test('and each head once, however many directives name it', () => {
        expect(rename('<p in:a.one out:a.two use:a.three>x</p>').heads).toEqual(['a']);
    });

    // A name the markup declared is Svelte's own, and stays as it is.
    test('but not a name the markup declared', () => {
        const { out, heads } = rename('{#each xs as act}<p use:act>x</p>{/each}');

        expect(heads).toEqual([]);
        expect(out).toContain('use:act>');
    });
});

describe('the binding it needs', () => {
    const script = (src, heads) =>
        compile(src, 'Probe', 'src/Probe.svelte', {
            pyDirectives: heads.map((head) => ({ head, renamed: `__dir_${head}` }))
        }).script;

    const python = (name) => `const __dir_${name} = __pyModule(() => __py["${name}"], "${name}");`;
    const javascript = (name) => `const __dir_${name} = ${name};`;

    test('reads the namespace for a module the file imports', () => {
        expect(script('import fades\n', ['fades'])).toContain(python('fades'));
    });

    // The name the import binds, which is not the module's own, and any name
    // the module binds: the cell of `chosen = measured` holds the raw Python
    // function.
    test.for([
        ['import fades as motion\n', 'motion'],
        ['from fades import typewriter\n', 'typewriter'],
        ['from fades import typewriter as typing\n', 'typing'],
        ['import fades.extra\n', 'fades'],
        ['def measured(node):\n    pass\n', 'measured'],
        ['def measured(node):\n    pass\nchosen = measured\n', 'chosen'],
        ['from fades import *\n', 'typewriter']
    ])('and for the name %s binds', ([src, name]) => {
        expect(script(src, [name])).toContain(python(name));
    });

    // A JavaScript name is that name, and one nothing binds is left to
    // JavaScript, as it was before the rename.
    test('but a JavaScript import is the JavaScript name', () => {
        const src = 'importjs {fades} from "./fades.js"\n\nx = 1\n';

        expect(script(src, ['fades'])).toContain(javascript('fades'));
    });

    test('and so is a name nothing binds', () => {
        expect(script('x = 1\n', ['fades'])).toContain(javascript('fades'));
    });

    // An import inside a `def` binds a local name, not one the directive reads.
    test('as is one imported inside a function', () => {
        expect(script('def load():\n    import fades\n', ['fades'])).toContain(javascript('fades'));
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
describe('what a module member becomes for Svelte', () => {
    const ready = () => {
        mount(DirectiveModule, { target: document.body.appendChild(document.createElement('div')) });
        flushSync();
        return pyModule(() => globalThis.__BRYTHON__.imported.directive_mod, 'directive_mod');
    };

    // Svelte hands a transition three arguments; the Python signature declares
    // two, and Python refuses the extra one rather than ignoring it.
    test('takes the arguments Svelte passes, trimmed to what Python declared', () => {
        const node = document.createElement('p');
        node.textContent = 'abcd';

        const config = ready().typewriter(node, {}, { direction: 'in' });

        expect(config.duration).toBe(4);
    });

    // And the config comes back readable from JavaScript: Svelte reads
    // `.duration` and calls `.tick` itself, with fractions.
    test('and hands back a config JavaScript can read and call', () => {
        const node = document.createElement('p');
        node.textContent = 'abcd';

        const config = ready().typewriter(node, {}, {});

        expect(typeof config.tick).toBe('function');

        config.tick(0.5, 0.5);
        expect(node.textContent).toBe('ab');
    });

    // Svelte keeps what a directive gave it, so two reads of the same name have
    // to answer the same object.
    test('and answers the same function twice', () => {
        const module = ready();

        expect(module.typewriter).toBe(module.typewriter);
    });
});
