// @vitest-environment node
//
// *A mutation that raises has still mutated*, held as a property of the code
// rather than as a habit.
//
// The rule is one sentence: an interception that notifies a watched object must
// notify it whether the operation returned or raised, which in JavaScript means
// from a `finally` or from a `catch` that rethrows. It was learned four times,
// each time at a site someone had written by copying the site next to it:
// `extend` consuming a generator that then raised, `|=` interrupted halfway,
// `__setattr__` writing before failing, and `__delattr__` an hour after the
// setter beside it was repaired.
//
// The interceptions are a closed set living in one function, which is why this
// can be read off the code the way `tests/brython-contract.test.js` reads
// `BRYTHON.md`: the wrappers are found by their shape, so a ninth entry point
// joins the check by existing, and cannot ship with the notification on the
// success path alone.
//
// Two of them were outside the rule when this was written — `$setitem` and
// `$delitem`, the subscript pair, which notified after the call returned. No
// bench distinguishes them today: everything an author can write inside a
// `__setitem__` of their own goes through another interception, and that one
// notifies. The shape is made uniform all the same, because what these defects
// have in common is not a failure of reasoning but a copy of the neighbouring
// site.
import { test, expect, describe } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('../src/lib/runtime.js', import.meta.url)), 'utf8');

// Comments and strings carry braces of their own — `{ob_type, im_func, im_self}`
// is written in four comments of this file — so the structure is read with those
// blanked out. Their length is kept, so an index still points at the same place.
function stripped(text) {
    const out = [...text];
    let at = 0;

    const blank = (from, to) => {
        for (let i = from; i < to; i++) if (out[i] !== '\n') out[i] = ' ';
    };

    while (at < text.length) {
        const one = text[at];
        const next = text[at + 1];

        if (one === '/' && next === '/') {
            const end = text.indexOf('\n', at);
            const stop = end === -1 ? text.length : end;

            blank(at, stop);
            at = stop;
        } else if (one === '/' && next === '*') {
            const end = text.indexOf('*/', at);
            const stop = end === -1 ? text.length : end + 2;

            blank(at, stop);
            at = stop;
        } else if (one === '"' || one === "'" || one === '`') {
            let i = at + 1;

            while (i < text.length && text[i] !== one) i += text[i] === '\\' ? 2 : 1;

            blank(at + 1, i);
            at = i + 1;
        } else at += 1;
    }

    return out.join('');
}

// From an opening brace to the one that closes it.
function block(text, open) {
    let depth = 0;

    for (let i = open; i < text.length; i++) {
        if (text[i] === '{') depth += 1;
        else if (text[i] === '}' && --depth === 0) return text.slice(open, i + 1);
    }

    throw new Error(`unbalanced braces from ${open}`);
}

const code = stripped(source);
const install = block(code, code.indexOf('{', code.indexOf('function installMutationTracking')));

// Every interception: a function put onto the engine under one of its own names,
// either directly or through the loop that covers `$setattr` and `$setattr1`.
const ENTRY = /\$B(?:(?:\.[A-Za-z_$][\w$]*)+|\[name\]) = function/g;

// Telling a watched object it changed, in the three spellings this file uses:
// the marker called on the spot, and the two helpers whose whole job is to call
// it.
const NOTIFIES = /MARKS\.get\([\w$]+\)\(\)|\bnotify\(|\bafterCall\(/;

const wrappers = [...install.matchAll(ENTRY)].map((found) => {
    const body = block(install, install.indexOf('{', found.index + found[0].length));

    return { name: found[0].slice(0, -' = function'.length), body };
});

describe('every interception that notifies, notifies on the raising path too', () => {
    // A guard that found nothing to check would be green for the wrong reason.
    test('the wrappers are found where they live', () => {
        expect(wrappers.map((one) => one.name)).toEqual([
            '$B.call_attr',
            '$B.$getattr',
            '$B.$setitem',
            '$B.$getitem',
            '$B.$delitem',
            '$B[name]',
            '$B.builtins.delattr',
            '$B.augm_assign'
        ]);
    });

    test.for([
        ['a mutation', (one) => NOTIFIES.test(one.body)],
        // The read paths are the other half of the same closed set: they hand
        // the watch down and notify nobody, and this is what says which is
        // which.
        ['a read', (one) => !NOTIFIES.test(one.body)]
    ])('%s is recognised by what it does', ([, holds]) => {
        expect(wrappers.filter(holds).length).toBeGreaterThan(0);
    });

    test('and no wrapper notifies only on the way out', () => {
        const offenders = wrappers
            .filter((one) => NOTIFIES.test(one.body))
            .filter((one) => {
                // The notification has to be inside the part that runs whatever
                // happened: a `finally`, or a `catch` that puts the exception
                // back. Anything after it, in the same wrapper, is the success
                // path and is not what is being asked about.
                const guarded = one.body.search(/\bfinally\b|\bcatch\b/);

                return guarded === -1 || !NOTIFIES.test(one.body.slice(guarded));
            })
            .map((one) => one.name);

        expect(offenders).toEqual([]);
    });
});
