// @vitest-environment node
//
// The third unguarded coupling in the project, made guarded.
//
// Almost nothing Svelthon touches in Brython is public API, so `BRYTHON.md` is
// the contract: it names each member, says what is read off it and why, and a
// Brython release can be checked against it. That only works if it is complete,
// and nothing made it complete. Measured on 2026-09-13 by a reader who counted:
// 28 members used, 24 named. The four it was missing were `$B.$call`,
// `$B.jsobj2pyobj`, `$B.Parser` and `$B.resolve_global`, and `jsobj2pyobj` is
// the function every value coming back from JavaScript passes through.
//
// A contract that is 88 % complete is a contract that will be trusted 100 %.
//
// Read the same way `tests/dispatch.test.js` reads its four lists: off the files
// themselves, so a twenty-ninth member cannot arrive unnoticed.
import { test, expect, describe } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const at = (path) => fileURLToPath(new URL(path, import.meta.url));

const LIB = at('../src/lib');
const contract = readFileSync(at('../BRYTHON.md'), 'utf8');

// `$B.x` and `__BRYTHON__.x` are the same object under two names, and both are
// written in these files.
const REACHED = /(?:\$B|__BRYTHON__)\.([A-Za-z_$][A-Za-z0-9_$]*)/g;

// Marks Svelthon itself hangs on the engine. They are ours to name and ours to
// change, so they are not part of anybody's contract.
const OURS = /^\$svelthon/;

const used = new Set();

for (const name of readdirSync(LIB)) {
    const source = readFileSync(join(LIB, name), 'utf8');

    for (const [, member] of source.matchAll(REACHED)) {
        if (!OURS.test(member)) used.add(member);
    }
}

describe('BRYTHON.md names every member the code reaches for', () => {
    test('there are members to check at all', () => {
        // The measurement above found 28. A regex that stopped matching would
        // otherwise make this file pass by finding nothing.
        expect(used.size).toBeGreaterThanOrEqual(28);
    });

    test.for([...used].sort().map((member) => [member]))('%s', ([member]) => {
        expect(contract).toContain(member);
    });
});
