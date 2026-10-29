// **A name of the author's spelled as one the compiler builds out of another is
// refused where it is written**: `value__` makes `__rev_value__` beside it, and
// a name ending with `__` passes the prefix rule as Python's own spelling, so
// `__rev_value__` written by the author was declared twice and Svelte refused
// the component in the compiler's code, `Identifier '__rev_value__' has
// already been declared`. Only a name the script does declare twice is.
import { test, expect } from 'vitest';
import { compile } from '../src/lib/compile.js';

const refusal = (src, options) => {
    try {
        compile(src, 'Probe', 'src/Probe.svelte', options);
    } catch (error) {
        return error.message;
    }

    return null;
};

test('a name the compiler builds out of another is refused at its line', () => {
    expect([
        refusal('value__ = 7\n__rev_value__ = 8\n'),
        refusal('value__ = 7\n__bump_value__ = 8\n'),
        refusal('def work__():\n    return 7\n\n\n__fn_work__ = 8\n'),
        refusal('def work__():\n    return 7\n\n\n__fn_work__ = 8\n', { plain: true })
    ]).toEqual([
        expect.stringContaining('`__rev_value__` is a name the compiler builds itself out of `value__`, in the same scope (src/Probe.svelte:2)'),
        expect.stringContaining('`__bump_value__` is a name the compiler builds itself out of `value__`'),
        expect.stringContaining('`__fn_work__` is a name the compiler builds itself out of `work__`'),
        expect.stringContaining('`__fn_work__` is a name the compiler builds itself out of `work__`')
    ]);
});

test('and a name ending with `__` that collides with nothing compiles', () => {
    expect([refusal('value__ = 7\n__all__ = ["value__"]\n'), refusal('class __rev_value__:\n    pass\n\n\nvalue__ = 7\n')]).toEqual([
        null,
        null
    ]);
});
