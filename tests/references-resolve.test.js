// @vitest-environment node
//
// Every file this project points at, in a file it ships, is a file someone can
// open.
//
// The comments here are dense with cross-references — a test that holds a rule,
// the vendored source a patch sits in, the document a decision is written in —
// and a reference that does not resolve is worse than no reference: it sends a
// reader looking for something that is not there, and it reads as authority
// while it does it.
//
// Two ways one goes wrong, and both happened:
//
// - **it never existed here.** Two shipped test files cited notes that live in
//   the working session's private memory directory, so a comment named something
//   only one machine could open. The lesson each pointed at was one clause long
//   and is written out now, which is what a lesson should be anyway.
// - **it stopped existing.** `BRYTHON_BUGS.md` pointed three times at the
//   vendored bundle under its old single-file name, with line numbers from it.
//   The bundle was split in two, the symbols moved to its runtime half, and the
//   citations stayed where they were.
//
// Only references into **our own directories** are checked, and that boundary is
// the whole precision of this guard. A backticked name is as often an *example*
// as a reference — `foo.py`, `src/ui/card.svelte`, `./store.py`,
// `src/hooks.server.py` are things an author writes, not things this repository
// holds — and Brython's own files are cited by name too, `py_type.js`,
// `descriptors.js`. Measured before this was written: 268 backticked file names,
// of which 121 resolve to nothing and nearly all of those are examples. The
// question *does this file exist* is only meaningful where the answer is ours to
// give.
import { test, expect, describe } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const at = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

// A path into one of these is a reference; anything else is prose. Bryntime's
// files are not among them: Svelthon names the package, never a file of it.
const OURS = ['tests/', 'src/lib/', 'scripts/', 'docs/'];

// A name with a directory in it and an extension we write, optionally followed
// by the line it sits at, as in `src/lib/compile.js:2753`.
const REFERENCE = /`([\w./-]+\/[\w./-]+\.(?:js|py|svelte|md|json|html))(?::\d+(?::\d+)?)?`/g;

const shipped = [
    ...readdirSync(at('src/lib'), { recursive: true, withFileTypes: true })
        .filter((one) => one.isFile())
        .map((one) => join('src/lib', relative(at('src/lib'), one.parentPath), one.name)),
    ...readdirSync(at('tests')).filter((one) => one.endsWith('.js')).map((one) => `tests/${one}`),
    // The documents a reader is handed: the README, in both languages, and
    // those the package ships.
    'README.md',
    'README.fr.md',
    ...JSON.parse(readFileSync(at('package.json'), 'utf8')).files.filter((one) => one.endsWith('.md'))
];

const cited = shipped.flatMap((file) =>
    [...readFileSync(at(file), 'utf8').matchAll(REFERENCE)]
        .map((found) => found[1])
        .filter((name) => OURS.some((one) => name.startsWith(one)))
        .map((name) => ({ file, name }))
);

describe('a reference in a shipped file', () => {
    // A guard that found nothing to check would be green for the wrong reason,
    // and this one is one regex away from checking nothing at all.
    test('there are references to check', () => {
        expect(cited.length).toBeGreaterThan(50);
    });

    test('points at a file that exists', () => {
        const missing = cited.filter(({ name }) => !existsSync(at(name)));

        expect(missing.map(({ file, name }) => `${file} → ${name}`)).toEqual([]);
    });

    // And the private half of the same rule: a shipped file may not name a note
    // that lives outside the repository. The directory is this machine's, so its
    // absence cannot be the assertion — what is asserted is that no shipped file
    // mentions one of the names it holds.
    test('and never names a note that only one machine can open', () => {
        const notes = join(
            process.env.HOME ?? '',
            '.claude/projects/<project>/memory'
        );

        if (!existsSync(notes)) return;

        const slugs = readdirSync(notes)
            .filter((one) => one.endsWith('.md') && one !== 'MEMORY.md')
            .map((one) => one.slice(0, -3));

        const named = shipped.flatMap((file) => {
            const text = readFileSync(at(file), 'utf8');

            return slugs.filter((slug) => text.includes(slug)).map((slug) => `${file} → ${slug}`);
        });

        expect(named).toEqual([]);
    });
});
