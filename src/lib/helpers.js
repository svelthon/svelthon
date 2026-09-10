// The template helpers, as ordinary functions.
//
// They used to live in `injected.cjs` as strings of JavaScript pasted into the
// generated component. That works, and it costs the one thing this set cannot
// afford: 90 lines of code that no coverage tool can instrument, holding the
// most user-facing behaviour in the project. `fromnow` alone chooses between
// seven units and two directions, and nothing could say which of those branches
// a test had never taken.
//
// So the values move here and `injected.cjs` keeps the *names*. What it emits is
// now a reference, `() => __helpers.date`, rather than a body.
//
// Why the generated script reaches them through one object rather than by name:
// a component is free to call its own state `date` or `batch`, and an import of
// that spelling would collide with the `let date = …` the compiler emits beside
// it. `__helpers` carries the prefix that says "generated", the same convention
// `__pybridge` and `__proto` follow.
import { NONE, __pybridge, plainData, pyData, ticking } from './runtime.js';

// A helper's refusal, in the dialect the rest of the project speaks.
//
// The eighteen refusals in `compile.cjs` and `markup.js` all open with
// `svelthon — ` and all name a file. These three could do neither: they run at
// render time, inside a compiled `__expr_N`, so the file is not theirs to know.
//
// The mark is what fixes that. `pyError` already receives the expression and the
// component from the wrapper that catches, and it now completes a marked error
// with them, which leaves the sentence here and the position there. Genuine
// JavaScript errors keep crossing untouched, which was the reason `pyError`
// stayed out of their way in the first place.
function refuse(message) {
    const error = new Error(`svelthon — ${message}`);

    error.$svelthon = true;

    return error;
}

// What a refusal shows of the value it refused.
//
// Not `JSON.stringify` alone: Python's None is an object with a reference back
// to its own class, so serialising it throws *Converting circular structure to
// JSON* and the refusal never gets to say what was wrong. `{date(maybe_none)}`
// is the commonest way to reach these two messages, and it was the one way to
// get a JavaScript accident instead of one.
function shown(value) {
    try {
        return JSON.stringify(value) ?? String(value);
    } catch {
        return __pybridge.str(value) || String(value);
    }
}

// Jinja's `|tojson`. A non-numeric indent is dropped rather than passed on:
// Python's None is an object, and `JSON.stringify(v, null, None)` would quietly
// indent with it.
export function tojson(value, indent) {
    return JSON.stringify(plainData(value), null, typeof indent === 'number' ? indent : undefined);
}

export function from_json(text) {
    return pyData(JSON.parse(text));
}

// Jinja's `|batch(3)`. A list of lists, not a lazy iterator: an `{#each}` reads
// its rows again on every update, and an iterator would come back empty the
// second time, silently, with the table simply gone.
//
// `fill` pads the last row. `None` there means *no padding*, not "pad with
// None", the rule every helper follows, since None is an object and would
// otherwise sail through an `!== undefined` test and be rendered as a cell.
export function batch(xs, size, fill) {
    if (!Number.isInteger(size) || size < 1) {
        throw refuse('batch(): size must be an integer of at least one');
    }

    const items = __pybridge.seq(xs);
    const out = [];

    for (let at = 0; at < items.length; at += size) {
        const row = items.slice(at, at + size);
        if (fill !== undefined && fill !== NONE) while (row.length < size) row.push(fill);
        out.push(__pybridge.list(row));
    }

    return __pybridge.list(out);
}

// Django's `|date`, under Django's word, with the platform's behaviour behind
// it. No format letters: `Intl` takes four styles and answers in the reader's
// own language, which Django's codes never do.
//
// `locale` matters most under server rendering: without it the server formats in
// *its* language and the browser reformats in the visitor's, which Svelte
// reports as a hydration mismatch.
export function date(value, dateStyle, timeStyle, locale) {
    const at = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(at.getTime())) {
        throw refuse('date(): ' + shown(value) + ' is not a date');
    }

    // A string, or absent. Python's None is an *object*, so testing against
    // undefined would hand Intl a Brython singleton and fail on a value the
    // author wrote as "nothing".
    const options = {};

    if (typeof dateStyle === 'string') options.dateStyle = dateStyle;
    if (typeof timeStyle === 'string') options.timeStyle = timeStyle;
    if (options.dateStyle === undefined && options.timeStyle === undefined) {
        options.dateStyle = 'medium';
    }

    const language = typeof locale === 'string' ? locale : undefined;

    return new Intl.DateTimeFormat(language, options).format(at);
}

const UNITS = [
    ['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]
];

// Django's `|timesince` and `|timeuntil` in one, which is why it carries neither
// word: `Intl` formats a *signed* gap, so the direction is in the value rather
// than in the name.
//
// Reading it registers the block with a shared clock, and the delay asked for is
// what the *display* needs: a second while it counts seconds, an hour once it
// counts days. So it slows down on its own as a date ages.
export function fromnow(value, locale) {
    const at = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(at.getTime())) {
        throw refuse('fromnow(): ' + shown(value) + ' is not a date');
    }

    const gap = (at.getTime() - Date.now()) / 1000;
    const size = Math.abs(gap);
    const [unit, span] = UNITS.find(([, s]) => size >= s) || UNITS[UNITS.length - 1];

    // When the shown number next changes: one whole unit from the last boundary
    // crossed, never the fixed beat of a generic timer.
    ticking(span * 1000 - ((size * 1000) % (span * 1000)));

    const language = typeof locale === 'string' ? locale : undefined;

    return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(
        Math.round(gap / span),
        unit
    );
}

// Django's `|slugify`. One rule, no option: normalise, lowercase, keep every
// letter, digit and mark, turn the rest into a dash.
//
// NFC, not NFD: `é` written as one code point and as `e` plus a combining acute
// look the same and must give the same URL.
//
// And marks are *kept*, which is not decoration: a Devanagari vowel sign is a
// combining mark with no composed form, so dropping marks turns `हिन्दी भाषा`
// into `ह-न-द-भ-ष-`. That is not folding a word, it is shredding it.
export function slugify(value) {
    return __pybridge
        .str(value)
        .normalize('NFC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\p{M}_]+/gu, '-')
        .replace(/^-+|-+$/g, '');
}

// Jinja's `|striptags`, done by the browser's own parser, because nothing else
// does it correctly. No fallback: off a browser this returns nothing rather than
// something wrong.
//
// Whitespace is collapsed, as Jinja does. Neither inserts a separator between
// blocks: `<p>a</p><p>b</p>` is `ab` there too.
export function striptags(value) {
    if (typeof DOMParser === 'undefined') return '';

    const text = new DOMParser().parseFromString(__pybridge.str(value), 'text/html').body
        .textContent;

    return (text || '').replace(/\s+/g, ' ').trim();
}

// Jinja's shape: a string, or a mapping that becomes a whole query string. Not
// Jinja's behaviour, and not Django's either: both leave `/` unquoted, which
// quietly turns `/tag/{urlencode(t)}` into two path segments.
export function urlencode(value) {
    // A Date is a value and never a mapping, and the sortable spelling is the
    // one a URL wants. Reading it through Python instead gave
    // `<Javascript object: [object Date]>`, escaped, in the query string.
    if (value instanceof Date) return encodeURIComponent(value.toISOString());

    // None is an object too, with `ob_type` and `__doc__` as own properties, so
    // without this it was walked as a mapping and `{urlencode(missing)}` wrote
    // `ob_type=%3Cclass+%27NoneType%27%3E&__doc__=` into the page. It is the
    // rule the whole set follows: None is absence, and absence encodes to
    // nothing.
    if (value !== NONE && value !== null && typeof value === 'object') {
        const pairs = new URLSearchParams();

        for (const key of Object.keys(value)) pairs.append(key, __pybridge.str(value[key]));

        return pairs.toString();
    }

    return encodeURIComponent(__pybridge.str(value));
}

// What the generated script binds. One object, one prefixed import, and the keys
// are the Python spellings so `injected.cjs` names them the way an author does.
export const helpers = {
    tojson,
    from_json,
    batch,
    date,
    fromnow,
    slugify,
    striptags,
    urlencode
};
