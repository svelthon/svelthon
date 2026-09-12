"""Rebuild vendor/brython.js and vendor/brython_runtime.js from Brython master.

One pass, two files, so they can never drift apart again: the runtime bundle was
built once on 2026-08-30 and was eleven days and two dev versions behind the full
one by the time anybody looked.

Not `make_dist.py`, which also regenerates `stdlib_paths.js`, `version_info.js`
and the VFS with whatever the local tree happens to hold. This does lines 33 to
61 of it and nothing else: concatenate `core_scripts`, minify each, write out.
Nothing in the Brython checkout is touched.

The runtime bundle is the full one with the parsing chain cut out, and the cut is
made **by the markers**, not by a module list of our own: `compiler_scripts` and
the two marker strings are read from Brython's own build scripts, so this runs
the same contract a stranger would run against a published `brython.js`.

Usage:  python3 scripts/vendor-brython.py [path-to-brython-checkout]
"""

import os
import sys

BRYTHON = sys.argv[1] if len(sys.argv) > 1 else '~/DEV/BRYTHON'
VENDOR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'vendor')

sys.path.insert(0, os.path.join(BRYTHON, 'scripts'))

import javascript_minifier                                  # noqa: E402
from version import version, implementation                 # noqa: E402
from directories import src_dir                             # noqa: E402
from core_scripts import core_scripts, compiler_scripts     # noqa: E402
from make_dist import COMPILER_CHAIN_OPEN, COMPILER_CHAIN_CLOSE  # noqa: E402

# The first of the two edits that stay ours, and that would be wrong upstream: a
# browser loads the script once per page, so the guard protects nothing there
# while changing the top-level shape of the file for everyone. See BRYTHON.md.
GUARD = """\
// /* SVELTHON patch, see BRYTHON.md */
// One interpreter per process. Under Node the compiler loads this file with
// require() and a server-rendered component imports it again, which are two
// module instances of the same file; `$B.builtins` marks that the body ran.
//
// `var` keeps its module scope inside a block, so the file below is untouched.
if (!(globalThis.__BRYTHON__ && globalThis.__BRYTHON__.builtins)) {
"""

# The second. Two, not eighteen: `$B.$import(...)` is Brython's own function and
# `vite:import-analysis` never looks at it.
VITE_IGNORE = [
    ('import(ref)', 'import(/* @vite-ignore */ ref)'),
    ('import(refs[0])', 'import(/* @vite-ignore */ refs[0])')
]


def build(skip=()):
    """The bundle, markers included, before any edit of ours.

    `skip` leaves modules out of the concatenation. Only used to check that
    cutting by the markers gives the same file.
    """
    out = (
        f'// brython.js brython.info\n'
        f'// version {version}\n'
        f'// implementation {implementation}\n'
        f'// version compiled from commented, indented source files at\n'
        f'// github.com/brython-dev/brython\n'
    )

    for name in core_scripts:
        if name in skip:
            continue
        if name == compiler_scripts[0]:
            out += COMPILER_CHAIN_OPEN
        out += javascript_minifier.minify(open(os.path.join(src_dir, name) + '.js').read() + '\n') + ';\n'
        if name == compiler_scripts[-1]:
            out += COMPILER_CHAIN_CLOSE

    return out


def cut(full):
    """The runtime bundle: everything but what sits between the markers."""
    start = full.index(COMPILER_CHAIN_OPEN)
    end = full.index(COMPILER_CHAIN_CLOSE) + len(COMPILER_CHAIN_CLOSE)

    return full[:start] + full[end:]


def chain(full):
    """What sits between the markers: the parsing chain, on its own.

    Each module of the concatenation is a complete `(function($B){…})(…)`, so
    the block stands alone and registers onto an engine that is already there.
    """
    start = full.index(COMPILER_CHAIN_OPEN) + len(COMPILER_CHAIN_OPEN)
    end = full.index(COMPILER_CHAIN_CLOSE)

    return full[start:end]


def ours(body):
    """The two edits that never go upstream."""
    for before, after in VITE_IGNORE:
        if before not in body:
            raise SystemExit(f'vendor-brython: `{before}` is gone, the @vite-ignore edit needs revisiting')
        body = body.replace(before, after, 1)

    return GUARD + body + '\n}\n'


def write(path, body):
    with open(path, 'w', newline='\n') as out:
        out.write(body)
    print(f'{os.path.relpath(path):34} {len(body):>9} bytes')


full = build()
runtime = cut(full)

# Checked on every build rather than taken on faith: cutting by the markers
# gives exactly what leaving those modules out of the concatenation gives. If it
# ever stops holding, the parsing chain has stopped being contiguous.
assert full.count(COMPILER_CHAIN_OPEN) == 1, 'the opening marker is not unique'
assert full.count(COMPILER_CHAIN_CLOSE) == 1, 'the closing marker is not unique'
assert COMPILER_CHAIN_OPEN not in runtime, 'the opening marker survived the cut'
assert COMPILER_CHAIN_CLOSE not in runtime, 'the closing marker survived the cut'
assert runtime == build(skip=compiler_scripts), 'cutting by marker and building without differ'

write(os.path.join(VENDOR, 'brython.js'), ours(full))
write(os.path.join(VENDOR, 'brython_runtime.js'), ours(runtime))

# The chain on its own, for a page that compiles: it loads after the runtime and
# registers `$B.Parser` and the rest onto the engine already there. No guard and
# no `@vite-ignore`, since neither edit has anything to do with these modules.
write(os.path.join(VENDOR, 'brython_compiler.js'), chain(full))

print(f'{"cut":34} {len(full) - len(runtime):>9} bytes '
      f'({100 * (len(full) - len(runtime)) / len(full):.1f} %)')
