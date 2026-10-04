// @vitest-environment node
//
// Build-time code: jsdom has no business here, and its null
// `document.currentScript` would break Brython's bootstrap.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

// A rune lives at the top level of a component's module, and nowhere else.
// `surface()` reads the AST and never descends into a `def` or a `class`, so a
// rune written deeper is built and wired to nothing.
//
// The arrow already refused it, by indentation, before parsing. The decorator
// said nothing at all — the same construct spoke under one spelling and vanished
// under the other, which is worse than either rule alone.
describe('a rune written below the top level', () => {
    const script = (src) => () => compile(src, 'Probe', 'src/Probe.svelte');

    test('is refused when decorated inside a function', () => {
        expect(script('def register():\n    @effect\n    def inner():\n        pass\n')).toThrow(
            /`@effect` is only read there \(src\/Probe\.svelte:3\)/
        );
    });

    test('and under a dotted decorator too', () => {
        expect(script('def register():\n    @effect.pre\n    def inner():\n        pass\n')).toThrow(
            /`@effect\.pre` is only read there/
        );
    });

    // The call form is what `x => expr` compiles to, so it is the same rune in
    // its other spelling, and it is the silent one: a decorator is an identity
    // here, the compiler reads the *name* it decorates off the AST, so
    // `effect(lambda: …)` written by hand builds nothing and says nothing.
    test('and when called by hand', () => {
        expect(script('def register():\n    x = effect(lambda: 1)\n')).toThrow(
            /`effect\(\)` is only read there/
        );
    });

    test('and for inspect, which is read off the AST the same way', () => {
        expect(script('def register():\n    y = inspect(1)\n')).toThrow(/`inspect\(\)`/);
    });

    // `inspect(count)` standing alone is the spelling the top level reads, and
    // below it the call was kept and logged nothing. `if DEBUG:` is the natural
    // way to write a conditional trace, so that is where it was lost.
    test.for([
        ['under an if', 'DEBUG = True\ncount = 0\nif DEBUG:\n    inspect(count)\n', '`inspect()`', 4],
        ['in a def', 'count = 0\ndef watch():\n    inspect(count)\n', '`inspect()`', 3],
        ['with a logger, in a def', 'count = 0\ndef watch():\n    inspect_with(print, count)\n', '`inspect_with()`', 3]
    ])('and inspect written as a statement is refused %s', ([, body, spelling, line]) => {
        expect(script(body)).toThrow(`${spelling} is only read there (src/Probe.svelte:${line})`);
    });

    test('while the same statement at the top level is the rune', () => {
        const { script: emitted } = compile('count = 0\ninspect(count)\n', 'Probe', 'src/Probe.svelte');

        expect(emitted.match(/\$inspect\(/g)).toHaveLength(1);
    });

    // A class body is no more the top level than a function body is.
    test('and inside a class', () => {
        expect(
            script('class Box:\n    @derived\n    def area(self):\n        return 1\n')
        ).toThrow(/`@derived`/);
    });

    // Nor is a block of the module: an `if`, a loop, a `try` may not run, and
    // a rune is wired whether it ran or not.
    test.for([
        ['under an if', 'if enabled:\n    @effect\n    def watch():\n        pass\n', '`@effect`'],
        ['called under an if', 'if enabled:\n    watch = effect(lambda: None)\n', '`effect()`'],
        ['in a loop', 'for one in []:\n    @derived\n    def total():\n        return 1\n', '`@derived`'],
        ['in a try', 'try:\n    @effect\n    def watch():\n        pass\nexcept Exception:\n    pass\n', '`@effect`']
    ])('and is refused %s', ([, body, spelling]) => {
        expect(script(`enabled = False\n${body}`)).toThrow(new RegExp(`${spelling.replace(/[()]/g, '\\$&')} is only read there`));
    });

    // A rune or `@export` on a name already declared would be dropped: the
    // first declaration decides what a name is. Refused, at the marker's line.
    test.for([
        ['@derived after an assignment', 'total = 0\n\n@derived\ndef total():\n    return 1\n', '`@derived`', 3],
        ['@effect after a def', 'def watch():\n    pass\n\n@effect\ndef watch():\n    pass\n', '`@effect`', 4],
        ['@export after an assignment', 'answer = None\n\n@export\ndef answer():\n    return 42\n', '`@export`', 3],
        ['the arrow after an assignment', 'n = 1\ntotal = 0\ntotal => n * 2\n', '`derived()`', 3],
        ['export() after an assignment', 'answer = None\nanswer = export(lambda: 42)\n', '`export()`', 2]
    ])('and is refused on a name already declared: %s', ([, body, spelling, line]) => {
        let error;
        try {
            script(body)();
        } catch (thrown) {
            error = thrown;
        }

        expect(error?.message).toContain(`${spelling} would be read on a name the first declaration has decided`);
        expect(error?.message).toContain(`src/Probe.svelte:${line})`);
    });

    test('while a plain reassignment of a declared name is untouched', () => {
        expect(script('n = 1\n\n@derived\ndef total():\n    return n\n\nn = 2\n')).not.toThrow();
    });

    test('but the top level itself is untouched', () => {
        expect(script('@effect\ndef top():\n    pass\n')).not.toThrow();
        expect(script('n = 0\n\n\ndoubled => n * 2\n')).not.toThrow();
    });

    test('and an ordinary nested function is nobody s business', () => {
        expect(script('def register():\n    def inner():\n        pass\n')).not.toThrow();
    });

    // The arrow refuses by indentation, before parsing, and said so first. The
    // two messages now describe the same rule.
    test('the arrow and the decorator now say the same thing', () => {
        const arrow = script('def register():\n    => print(1)\n');
        const decorated = script('def register():\n    @effect\n    def inner():\n        pass\n');

        expect(arrow).toThrow(/belong[s]? at the top level of the module/);
        expect(decorated).toThrow(/belongs at the top level of the module/);
    });
});
