// What Python raises, as JavaScript reads it: the exception described, its
// message and its stack filled in, placed where its frames are. Moved out of
// the runtime as it was; the host reaches it through `bryntime.js`.
import * as core from './crossing.js';

const { NONE, _b_, refused, lent } = core;

// The traps of a view, each relaying what Python raises under it as a call
// does (`pyCall`): the exception itself, its message filled in, so JavaScript
// reads what went wrong and a Python caller that handed the value over still
// catches its own `ValueError`. Thrown as it came, a JavaScript reader found
// no message on it. An error of JavaScript's, a refusal of the view's own,
// passes as it is.
export const relayed = (handler, where) => {
    for (const [trap, run] of Object.entries(handler)) {
        handler[trap] = function (...args) {
            try {
                return run.apply(this, args);
            } catch (error) {
                throw pyError(error, where);
            }
        };
    }

    return handler;
};

// A Brython exception reaching JavaScript carries no `message` and no `stack`,
// so devtools and Vite's overlay show nothing at all: the text sits in the
// Python object, where nothing JS looks. Fill both in, keeping the original
// object so Python semantics upstream are untouched.
export function pyError(error, where) {
    const $B = globalThis.__BRYTHON__;

    // A refusal, thrown by a template helper or by a crossing rather than by
    // Python. It carries its own sentence; what it cannot know from inside
    // `date()` is which expression called it, and that is exactly what `where`
    // holds. Known by `refused` rather than sniffed, so a genuine JavaScript
    // error keeps crossing untouched. Signed already, with this project's name
    // (`host.name`), wherever it was made.
    if (refused(error) && !error.$located) {
        error.$located = true;
        error.message = `${error.message} (${where})`;
    }

    if (!error || typeof error !== 'object' || error.message !== undefined) return error;

    // Not ours to describe: a JavaScript value thrown through a Python frame,
    // and SvelteKit's own `error()` and `redirect()` do exactly that, must come
    // the other side untouched, or the framework will not recognise it.
    try {
        if (globalThis.__BRYTHON__.get_class(error) === undefined) return error;
    } catch {
        return error;
    }

    let described;
    try {
        // Not `cls.__name__`: a Brython class keeps it out of its JS properties,
        // so the lookup has to go through Python's own attribute protocol.
        const name = $B.$getattr($B.get_class(error), '__name__');
        described = `${name}: ${_b_.str.$factory(error)}`;
    } catch {
        described = 'PythonError';
    }

    // Each frame of the traceback, with its file. The first one is the code
    // `where` names, and its line is the deepest one still in that file: line
    // numbers count from the start of the Python source, which for a component
    // begins after its opening <script> tag, hence the host's `lent.place` back
    // to the file's own numbering. A deeper frame in another file is where it
    // actually broke, and it is named with its own file and its own line,
    // placed the same way.
    const frames = [];
    try {
        let tb = $B.$getattr(error, '__traceback__');
        while (tb && tb !== NONE) {
            const code = $B.$getattr($B.$getattr(tb, 'tb_frame'), 'f_code');
            frames.push({
                file: $B.$getattr(code, 'co_filename'),
                name: $B.$getattr(code, 'co_name'),
                line: $B.$getattr(tb, 'tb_lineno')
            });
            tb = $B.$getattr(tb, 'tb_next');
        }
    } catch {
        /* no usable traceback */
    }

    const home = frames[0]?.file;
    const own = frames.filter((frame) => frame.file === home).at(-1);
    const deepest = frames.at(-1);

    let at = own === undefined ? where : `${where}:${lent.place(home, own.line)}`;
    if (deepest !== undefined && deepest.file !== home) {
        at += `; raised in ${deepest.name}(), ${deepest.file}:${lent.place(deepest.file, deepest.line)}`;
    }

    try {
        error.message = `${described} (${at})`;
        if (error.stack === undefined) error.stack = `${error.message}\n    at ${at}`;
    } catch {
        /* a frozen exception: pass it on as it stands */
    }

    return error;
}

// What leaves a handler, where nothing Python will catch it again.
//
// `pyError` fills a `message` and a `stack` into the Brython exception and hands
// back **the same object**, deliberately: Python semantics upstream have to be
// untouched, and a `except ValueError` further up must still see its own value.
// A DOM handler is the other end of that: past it there is no Python left, only
// whatever the host does with an uncaught error.
//
// What the host does is walk it. A Brython exception carries `ob_type`, and from
// there its class and `__mro__`, which contains itself, so a runner cloning the
// error to send it from its worker to the main thread walks a cycle through a
// class object: `Aborted (core dumped)`, `OOMErrorHandler`, on a five-line
// component whose handler raises.
//
// So the boundary hands over an ordinary `Error` and **keeps nothing of the
// Python object on it**, not even under a non-enumerable property: the walk
// reaches an own property whether it is enumerable or not, so a reference kept
// for a debugger is a reference kept for the serialiser.
export function thrown(error) {
    if (error instanceof Error || error === null || typeof error !== 'object') return error;

    // `??` and not `||`, and a mutation sweep cannot tell: the difference is an
    // **empty** message, and the only caller runs `pyError` first, which
    // describes the exception and hands back an `Error`, so the line above
    // returns and this one is reached only for what `pyError` chose to leave
    // alone. Left as it is rather than pinned: a test would fix `''` as the
    // answer, and `''` is the less useful of the two.
    const out = new Error(error.message ?? 'PythonError');

    if (typeof error.stack === 'string') out.stack = error.stack;

    return out;
}
