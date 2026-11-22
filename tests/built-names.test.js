// **A name the compiler builds out of another starts with its prefix, whatever
// it ends with**: `value__` makes `__brycomp_rev_value__` beside it. Under the
// old rule, a name ending with `__` passed as Python's own spelling, so
// `__rev_value__` written by the author was declared twice and Svelte refused
// the component in the compiler's code, `Identifier '__rev_value__' has
// already been declared`. Now the prefix alone decides: the author's
// `__rev_value__` is theirs, and only a name spelled with the prefix is refused,
// whether the script declares it or an import binds it.
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

const PREFIX = 'starts with `__brycomp_`, which is the compiler\'s own prefix';

test('a name spelled as one the compiler builds out of another is refused by its prefix', () => {
    expect([
        refusal('value__ = 7\n__brycomp_rev_value__ = 8\n'),
        refusal('value__ = 7\n__brycomp_bump_value__ = 8\n'),
        refusal('def work__():\n    return 7\n\n\n__brycomp_fn_work__ = 8\n')
    ]).toEqual([
        expect.stringContaining(`\`__brycomp_rev_value__\` ${PREFIX} (src/Probe.svelte:2)`),
        expect.stringContaining(`\`__brycomp_bump_value__\` ${PREFIX}`),
        expect.stringContaining(`\`__brycomp_fn_work__\` ${PREFIX}`)
    ]);
});

// So is a name an import from JavaScript binds.
test('a name an import binds, spelled with the prefix, is refused', () => {
    const js = 'data:text/javascript,export const __brycomp_var_value__ = 8, __brycomp_rev_value__ = 8, __brycomp_fn_work__ = 8';

    expect([
        refusal(`__js__ = {"${js}": ["__brycomp_var_value__"]}\nvalue__ = 7\n`, { plain: true }),
        refusal(`importjs {__brycomp_rev_value__} from "${js}"\nvalue__ = 7\n`),
        refusal(`importjs * as __brycomp_fn_work__ from "${js}"\ndef work__():\n    return 7\n`)
    ]).toEqual([
        expect.stringContaining('`__brycomp_var_value__`'),
        expect.stringContaining('`__brycomp_rev_value__`'),
        expect.stringContaining('`__brycomp_fn_work__`')
    ]);
});

// And the author's own names, however close to the compiler's they look.
test('a name ending with `__` or starting with `__`, without the prefix, compiles', () => {
    expect([
        refusal('value__ = 7\n__rev_value__ = 8\n'),
        refusal('def work__():\n    return 7\n\n\n__fn_work__ = 8\n'),
        refusal('value__ = 7\n__all__ = ["value__"]\n'),
        refusal('importjs imported from "data:text/javascript,export default function __doc__(){return 7}"\n__doc__ = "okay"\n'),
        refusal('importjs {__rev_value__} from "data:text/javascript,export const __rev_value__ = 8"\nvalue__ = 7\n')
    ]).toEqual([null, null, null, null, null]);
});
