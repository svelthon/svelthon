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
import {
    NONE,
    __pybridge,
    callable,
    plainData,
    plainObject,
    pyClass,
    pyCoroutine,
    pyScalar,
    pyEntries,
    pyName,
    isSet,
    opaque,
    pyBytes,
    thenable,
    ticking
} from './runtime.js';

// What the author wrote, as a value JavaScript can read with `typeof`.
//
// Python's `str`, `int` and `float` subclasses are *objects* here, holding the
// value in a field, and `typeof` says `object` for all three. Every helper in
// this file asked its own narrow question about the values it takes, and each
// one answered wrongly in its own way for the same input: `batch` refused a
// size, `date` refused a timestamp — which in a template is a component that
// does not mount — and then, seven lines further on, silently ignored a style
// and formatted in the default one.
//
// Shared recognition, not shared rules. Each helper still says for itself what
// it will accept; this only lets it see what it was handed. A value that is not
// a Python scalar comes back untouched, so every refusal already written stands.
const written = (value) => pyScalar(value) ?? value;

// The instant a Date holds, whichever JavaScript context built it — and
// `undefined` for anything that is not a Date at all.
//
// `instanceof Date` asks about *our* Date constructor, and an iframe, a worker,
// a `vm` context or a SvelteKit adapter has its own: a Date from one of them is
// a Date by every behaviour and answers false, so `{date(stamp)}` refused a
// perfectly good value and the component did not mount. The same realm mistake
// the route boundary made with `URL`, at the three sites of this file, and it
// was mine to sweep there and I did not.
//
// `getTime` called against the value is the brand itself: the internal slot a
// Date carries is per-object, not per-realm, so this accepts every context's
// Date and throws for everything else — including an object that sets
// `Symbol.toStringTag` to 'Date', which `Object.prototype.toString` would
// believe. An invalid Date answers NaN, which is a number and therefore an
// answer; the caller's own domain decides what to do with it.
const instantOf = (value) => {
    try {
        return Date.prototype.getTime.call(value);
    } catch {
        return undefined;
    }
};

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
    // A function is the one shape with neither a JSON notation nor a useful
    // `String()`, which would be its whole source text. Three things may know
    // its name and they are asked in the order they are trustworthy: what Python
    // recorded, then the name JavaScript gave it — which is what names a
    // function an author imported through `__js__`, where Python knows nothing
    // and `str()` answers `<JavascriptFunction object>` for every one of them.
    //
    // An anonymous arrow has neither, and the generic wording below is then the
    // best available rather than a shortcoming: nothing on the value knows what
    // it was called.
    if (typeof value === 'function') {
        const named = pyName(value) ?? (value.name || null);

        if (named !== null) return named;
    }

    try {
        // `undefined` rather than a throw is what `JSON.stringify` answers for
        // the values it has no notation for, a function among them, and
        // `String(fn)` is then the whole source text of it — a refusal printing
        // a page of generated JavaScript at an author who wrote `tojson(save)`.
        // Python's own repr is what names it.
        //
        // `||` and not `??` on the second step, which is what the catch below
        // already does: `str()` answers the empty string for the absence of a
        // value, and a refusal reading `date():  is not a date` names nothing.
        return JSON.stringify(value) ?? (__pybridge.str(value) || String(value));
    } catch {
        return __pybridge.str(value) || String(value);
    }
}

// A Python int above 2^53 is a JavaScript BigInt, and `JSON.stringify` refuses
// one outright: `TypeError: Do not know how to serialize a BigInt`, a JavaScript
// accident out of a template filter, where `json.dumps(2 ** 70)` writes the
// digits. Svelthon renders that very number on its own front page, so this was
// the one place a big integer was refused.
//
// The digits have to go out *unquoted*, which a replacer cannot do by itself: a
// BigInt back from it throws again and a string comes out in quotes.
// `JSON.rawJSON` is the answer the language grew for this, and it is checked
// rather than assumed, so an engine without it throws the message it throws
// today instead of a stranger one about `rawJSON`.
const raw = (one) =>
    typeof one === 'bigint' && typeof JSON.rawJSON === 'function' ? JSON.rawJSON(`${one}`) : one;

// The same edge, met by the two date helpers. `new Date(2 ** 70)` refuses a
// BigInt outright, `Cannot convert a BigInt value to a number`, and it throws
// before the Invalid Date guard below can say whose fault it is: the author
// wrote `{date(count)}` and read a JavaScript accident.
//
// Turning it into a number changes no answer. `Date` spans ±275 760 years,
// which is ±8.64e15 milliseconds, so every integer big enough to be a BigInt is
// already outside it: the value is invalid either way, and this is only
// about which sentence says so.
const moment = (value) => (typeof value === 'bigint' ? Number(value) : value);

// What `new Date` accepts is wider than what an author can mean, and it says so
// in silence: it coerces a value through its *string* form, so `date([2026])`
// answered 1 January 2026 and `date([1, 2])` answered 2 January 2001. A boolean
// went the other route and answered 1 January 1970.
//
// So the shapes are named here rather than left to coercion, and everything else
// becomes an Invalid Date, which is the refusal the two helpers already word. A
// big integer still reaches that refusal through `moment`, since every integer
// large enough to be one is outside the range `Date` spans.
function instant(value) {
    const held = instantOf(value);

    // A Date of any context, rebuilt as one of ours so everything downstream —
    // `getTime`, `Intl.DateTimeFormat.format` — is handed a value from the realm
    // that will read it.
    if (held !== undefined) return new Date(held);

    // `written` first, then this helper's own domain: what is shared is the
    // recognition, not the rule about what a date may be.
    //
    // The line this replaces asked `pyScalar` and kept its answer **only when it
    // was a number**, so `class Stamp(float)` was repaired and `class Text(str)`
    // holding an ISO date was not — and the two are one question. The domain
    // below is unchanged: a string or a number is a date, a boolean, a list or
    // an object is not.
    const one = moment(written(value));

    return typeof one === 'string' || typeof one === 'number' ? new Date(one) : new Date(NaN);
}

// Jinja's `|tojson`. A non-numeric indent is dropped rather than passed on:
// Python's None is an object, and `JSON.stringify(v, null, None)` would quietly
// indent with it.
// A class has no JSON, and since `plainData` stopped flattening one it reaches
// here whole. A Brython class carries its own `__mro__`, which contains itself,
// so `JSON.stringify` answers `Converting circular structure to JSON`: V8's
// sentence, naming nothing and pointing at no line.
//
// This is the same argument `shown()` above is written for, one function over. A
// serialiser meeting something it cannot serialise owes the author a sentence,
// and Python's own is `Object of type type is not JSON serializable`.
//
// Handing the class over whole is right at the *boundary*, where JavaScript can
// call it; it is not a thing to write into a page.
const serialisable = (one) => {
    // **A number that is not finite.** JSON has no notation for `NaN` or
    // `±Infinity`, and `JSON.stringify` writes `null` for them: a page said
    // `null` where the model held a division by zero or an overflow, which is a
    // different value and nothing said so. It belongs to the same family as
    // every other refusal here — a shape the serialiser silently replaces — and
    // it is the one that arrives without an object around it.
    //
    // CPython writes `NaN` and `Infinity`, which is not JSON either: the
    // `JSON.parse` on the other side of a page refuses both. So there is no
    // answer to hand over quietly, and the author is the one who knows what the
    // page should say.
    if (typeof one === 'number' && !Number.isFinite(one)) {
        throw refuse(
            `tojson(): ${one} has no JSON — JSON has no notation for it and ` +
                `JSON.stringify writes \`null\` instead, which is a different value. ` +
                `Decide what the page should hold — None, 0, or a string — and write that.`
        );
    }

    if (pyClass(one)) {
        throw refuse(`tojson(): ${shown(one)} is a class, and a class has no JSON`);
    }

    // What a `toJSON` hands back arrives here without the walk, since
    // `JSON.stringify` calls the hook itself, with its receiver and its key. So
    // the walk's refusals are asked of it again, at any depth; on the walk's own
    // output none of these can arrive.
    const walkRefuses =
        typeof one === 'symbol' ||
        callable(one) ||
        (one !== null &&
            typeof one === 'object' &&
            (thenable(one) || pyCoroutine(one) || isSet(one) || pyBytes(one) || opaque(one)));

    if (walkRefuses) noCall(one);

    return raw(one);
};

// The neighbouring shape, which had the rule stated one branch away and no arm
// of its own. `JSON.stringify` has no notation for a call, so it drops it, and
// the dropping is a different wrong answer in each position: `undefined` for a
// value, a **key that disappears** from an object, `null` for an item of a list.
// The first is the worst, since `tojson` is written in templates and `undefined`
// renders as nothing at all.
//
// Handed to the *walk* rather than to the replacer, and that is the whole of why
// this is a rule and not a fourth branch above. `plainData` asks it of a
// callable at any depth, before anything is flattened; by the time a replacer
// runs, an instance whose class defines `__call__` has already become its
// fields — `{"on_save": Handler(db)}` was written out as `{"on_save": {}}`, a
// page saying the registry is empty.
//
// It is the boundary's own predicate, so the three shapes answer together: a
// function, a bound method, and a callable instance. The fields of that instance
// are not what it is — the export hands it to JavaScript as its call.
const noCall = (one) => {
    // The walk hands this rule five shapes now, and the name it still carries is
    // the first of them. What they share is the sentence: *there is no JSON for
    // this*, said about the value the author passed rather than about whatever
    // the walk had in hand by the time it noticed.
    //
    // **Awaitable**, in either language: a call not yet made and a call made and
    // not finished. The coroutine used to be *started* by the asking — the
    // serialiser scheduled the body and wrote `{}` — and a promise said `{}`
    // without even that excuse. A bare thenable used to be told its `then` was
    // callable, which is one value answered two ways by which constructor built
    // it.
    if (pyCoroutine(one) || thenable(one)) {
        const kind = pyCoroutine(one) ? 'coroutine' : 'promise';

        throw refuse(
            `tojson(): ${shown(one)} is a ${kind}, and a ${kind} has no JSON until it ` +
                `is awaited. Await it and serialise what it answers.`
        );
    }

    // **Callable**, and it comes second because it is the most specific thing a
    // value can be here. A lambda, a bound method and a callable instance all
    // carry a class, so the general Python arm below would answer for them —
    // measured, by twelve cells turning red — and *callable* is what they are.
    // A plain JavaScript function is caught here too, where the last arm would
    // otherwise call it a Function.
    if (callable(one)) {
        throw refuse(`tojson(): ${shown(one)} is callable, and a call has no JSON`);
    }

    // **A Python set**, named as itself. It is a plain object holding `$store`
    // and `ob_type`, so the walk reached its class first and the refusal that
    // came out said `<class 'set'> is a class` — about an instance. Python's own
    // answer is `Object of type set is not JSON serializable`, and the way out
    // is the one a Python author already knows.
    if (isSet(one)) {
        throw refuse(
            `tojson(): ${__pybridge.str(one)} is a set, and a set has no JSON. ` +
                `Convert it with list() and serialise that.`
        );
    }

    // **Bytes**, which got the set's wrong accusation at the neighbouring type,
    // for the same reason: `{ob_type, source}`, walked, class reached first.
    // CPython refuses them too, and the two ways out are the ones a Python
    // author reaches for depending on what the bytes hold.
    if (pyBytes(one)) {
        throw refuse(
            `tojson(): ${__pybridge.str(one)} is bytes, and bytes have no JSON. ` +
                `Decode them with .decode() for text, or list() for the numbers.`
        );
    }

    // **A symbol**, the last of the shapes `JSON.stringify` drops in silence: as
    // a value it wrote nothing at all, under a key it wrote `{}`. `shown` cannot
    // name one — `JSON.stringify` answers undefined for it too — so it says its
    // own description.
    if (typeof one === 'symbol') {
        throw refuse(`tojson(): ${String(one)} is a symbol, and a symbol has no JSON`);
    }

    // **Any other Python value with nothing to write**: a range, a complex, and
    // whatever the standard library adds. The two arms above say more because
    // their way out is known; this one says what CPython says — *Object of type
    // range is not JSON serializable* — naming the class of the value rather
    // than accusing it of being one.
    if (pyClass(one.ob_type)) {
        const named = globalThis.__BRYTHON__.class_name(one);

        throw refuse(
            `tojson(): ${__pybridge.str(one)} is a ${named}, and a ${named} has no JSON`
        );
    }

    // **A native object the serialiser has nothing to write of.** A Map and a Set
    // keep their entries where no enumerable property reaches, so
    // `tojson(new Map([["answer", 42]]))` answered `{}` — and `{"map":{}}` one
    // level down, where the shape around it makes the empty object look like an
    // answer. Naming it is the whole repair: choosing a JSON shape for a Map
    // whose keys are not strings would be inventing one.
    // Named by its class, which is what an author recognises. The tag alone
    // answers `Object` for every class anyone writes, so the constructor is
    // asked first and the tag is the fallback for a value that has none.
    const named =
        Object.getPrototypeOf(one)?.constructor?.name ||
        Object.prototype.toString.call(one).slice(8, -1);

    throw refuse(
        `tojson(): a ${named} has no JSON of its own. Give it a toJSON(), or build ` +
            `the object or the list you want written and serialise that.`
    );
};

export function tojson(value, indent) {
    // The same question as the date styles below, asked of a number: a
    // `class Width(int)` reads as an object here and the output came out on one
    // line, which is a difference nobody sees in a page.
    const spaces = written(indent);

    return JSON.stringify(
        // The JSON rule, asked for by name. JSON has neither identity nor
        // cycles, so a shared reference comes out twice and a loop comes out
        // `null` — the only thing a serialiser can do, and the reason that rule
        // was written. It is not the default any more: the other five callers of
        // `plainData` hand their result to JavaScript, which has identity.
        plainData(value, new Set(), noCall),
        (_, one) => serialisable(one),
        typeof spaces === 'number' ? spaces : undefined
    );
}

// Python's `javascript.JSON.parse`, not the `JSON.parse` of the language this
// file is written in. Brython registers its builtin modules as the engine loads,
// and importing `runtime.js` has loaded it, so there is nothing to wait for.
const parseJson = (() => {
    const $B = globalThis.__BRYTHON__;

    return $B.$getattr($B.$getattr($B.imported.javascript, 'JSON'), 'parse');
})();

// And the way back, through Brython's route rather than the JavaScript one.
//
// It used to be `JSON.parse` with a reviver of our own for `null`, and that
// reviver is the reason this changed: a reviver cannot repair an integer past
// 2^53, because `JSON.parse` has already made a double of it by the time one
// runs. `javascript.JSON` reads the source text of the literal instead, so the
// digits survive, and it answers `None` for `null` at every depth without our
// help.
//
// Measured against the old route on fourteen documents, containers and bare
// values, and on three malformed ones: the same value everywhere except the
// large integers, and the same refusal to the character.
export function from_json(text) {
    return parseJson(text);
}

// Jinja's `|batch(3)`. A list of lists, not a lazy iterator: an `{#each}` reads
// its rows again on every update, and an iterator would come back empty the
// second time, silently, with the table simply gone.
//
// `fill` pads the last row. `None` there means *no padding*, not "pad with
// None", the rule every helper follows, since None is an object and would
// otherwise sail through an `!== undefined` test and be rendered as a cell.
export function batch(xs, size, fill) {
    // The same recognition, for the same reason: `Number.isInteger` asked of the
    // object a Python `int` subclass is answers false, so a perfectly good size
    // was refused before its value was ever read. The constraint below is this
    // helper's own and stays exactly as it was.
    size = written(size);

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
// A date and nothing else: the one shape that is a day rather than an instant.
const DAY_ONLY = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function date(value, dateStyle, timeStyle, locale) {
    const at = instant(value);

    if (Number.isNaN(at.getTime())) {
        throw refuse('date(): ' + shown(value) + ' is not a date');
    }

    // A string, or absent. Python's None is an *object*, so testing against
    // undefined would hand Intl a Brython singleton and fail on a value the
    // author wrote as "nothing".
    //
    // And `written`, because a `class Text(str)` is an object here too — this
    // read it as absent and formatted in the default style, which is the same
    // defect as the one above without the mercy of an error: `date(when,
    // Text("full"))` rendered a medium date and said nothing.
    const options = {};
    const style = written(dateStyle);
    const clock = written(timeStyle);

    if (typeof style === 'string') options.dateStyle = style;
    if (typeof clock === 'string') options.timeStyle = clock;
    if (options.dateStyle === undefined && options.timeStyle === undefined) {
        options.dateStyle = 'medium';
    }

    // **A date with no time is a calendar day, not an instant.** The
    // specification reads `"2026-08-24"` as midnight *UTC*, and `Intl` then
    // renders that instant in the reader's zone: every reader west of Greenwich
    // was shown the day before, so `date("2026-08-24")` answered 23 August in
    // Los Angeles and nothing said so.
    //
    // Python answers this without ambiguity — `datetime.date(2026, 8, 24)`
    // carries no zone, and Django's `|date`, which is this helper's word,
    // renders that day wherever it is read. The standard library is not
    // available to a component either, so a string is all an author has to say
    // *a day* with.
    //
    // Rendered in the zone the specification already put it in, which is what
    // keeps the day the author wrote the day every reader sees. The three
    // shapes that carry a time are untouched: they are instants, and an instant
    // belongs in the reader's zone.
    if (DAY_ONLY(written(value))) options.timeZone = 'UTC';

    const language = written(locale);

    return new Intl.DateTimeFormat(
        typeof language === 'string' ? language : undefined,
        options
    ).format(at);
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
    const at = instant(value);

    if (Number.isNaN(at.getTime())) {
        throw refuse('fromnow(): ' + shown(value) + ' is not a date');
    }

    const gap = (at.getTime() - Date.now()) / 1000;
    const size = Math.abs(gap);
    const last = UNITS.length - 1;
    const band = UNITS.findIndex(([, s]) => size >= s);
    const [unit, span] = band === -1 ? UNITS[last] : UNITS[band];
    const count = Math.round(gap / span);

    // When the text next changes, which is not when the *gap* next crosses a
    // whole unit. The delay used to be the remainder of one, and the display is
    // rounded: a date 90.1 seconds ahead reads "in 2 minutes" and stops being
    // true 0.1 second later, where that arithmetic asked to be woken in 29.9.
    //
    // Two boundaries, and the nearer one wins. The shown number turns over half
    // a unit from here — `Math.round` ties towards +∞, and the gap only ever
    // decreases, so the next tie is the one below. And the unit itself changes
    // when the gap leaves its band: "in 1 hour" becomes "in 60 minutes" a second
    // later, which no half-minute calculation would have caught.
    const rounding = gap - (count - 0.5) * span;
    const leaving =
        band === -1
            ? Infinity
            : gap > 0
              ? (band === last ? Infinity : gap - span)
              : (band === 0 ? Infinity : UNITS[band - 1][1] - size);

    ticking(Math.max(1, Math.min(rounding, leaving) * 1000));

    const language = written(locale);

    return new Intl.RelativeTimeFormat(typeof language === 'string' ? language : undefined, {
        numeric: 'auto'
    }).format(count, unit);
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

    const parsed = new DOMParser().parseFromString(__pybridge.str(value), 'text/html');

    // A script and a style hold text that is not text of the document, and
    // `textContent` cannot tell the difference. Dropping the source of a script
    // is a rule this helper already claimed — `tests/stripped.test.js` has
    // asserted it since the day it was written — and it held by an **accident of
    // parsing**: a `<script>` opening the fragment lands in `<head>`, which is
    // not read here, while the same element between two words lands in `<body>`
    // and printed `alert("x")` into the page. One element, two answers, decided
    // by where it stood.
    //
    // This is where the project takes its own answer rather than Jinja's, and it
    // is written where the test says so: the regex behind `|striptags` keeps
    // what a script holds, and what a template wants is the visible document.
    for (const one of parsed.body.querySelectorAll('script, style')) one.remove();

    const text = parsed.body.textContent;

    return (text || '').replace(/\s+/g, ' ').trim();
}

// Which values become a query string rather than a single encoded value.
//
// It used to be `typeof value === 'object'`, with `None` named as the one
// exception, and that was one instance of a general problem rather than the
// problem: almost everything in Python is an object here. A float is
// `{ob_type, value}`, so `{urlencode(1.5)}` wrote
// `ob_type=%3Cclass+%27float%27%3E&value=1.5` into the page; a list added
// `ob_type=<class 'list'>` after its items, and a set wrote its whole internal
// store. Jinja reads a float as a plain value, `1.5`, and so do we now.
//
// So the shapes are named: a Python dict, or a plain JavaScript object, which is
// what `js.` interop and a `load()` hand over. `$B.is_dict` answers the first
// without touching the object's symbols, which matters because SvelteKit wraps
// `event.params` in a proxy that records every key read.
function mapping(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    if (globalThis.__BRYTHON__.is_dict(value)) return true;

    // The same question `plainData` asks, asked of the same predicate. This line
    // read `=== Object.prototype` and the converter accepted a null prototype
    // too, so one shape crossed three ways: `to_js` and `tojson` rendered it and
    // `urlencode` wrote `<Javascript object: [object Object]>` into the page.
    // A **class** under that name, and not the name alone. `ob_type` is
    // Brython's mark, and a foreign object is free to carry a field spelled the
    // same: `{ob_type: "business", value: 42}` came out of `urlencode` as
    // `%5Bobject%20Object%5D`, every parameter gone, while the identical Python
    // dict encoded correctly. The question is *is this a Python object*, and
    // `pyClass` is what the rest of the project asks — the same repair the
    // inbound converter got when it read `ob_type === undefined`.
    return !pyClass(value.ob_type) && plainObject(value);
}

// Jinja's shape: a string, or a mapping that becomes a whole query string. Not
// Jinja's behaviour, and not Django's either: both leave `/` unquoted, which
// quietly turns `/tag/{urlencode(t)}` into two path segments.
//
// A key that is not a string is written the way `str()` writes it, and two that
// collide once written both stay: measured against CPython's
// `urllib.parse.urlencode`, which answers `1=a&1=b` for `{1: "a", "1": "b"}`.
export function urlencode(value) {
    // A Date is a value and never a mapping, and the sortable spelling is the
    // one a URL wants. Reading it through Python instead gave
    // `<Javascript object: [object Date]>`, escaped, in the query string.
    //
    // The third site that asked `instanceof`, and the third to refuse a Date
    // built in another JavaScript context: this one said nothing and wrote the
    // Python spelling of the object into the query string.
    const held = instantOf(value);

    if (held !== undefined) {
        // An invalid Date is still a Date, and `toISOString` answers it with
        // `RangeError: Invalid time value` — a JavaScript accident out of a
        // template filter, where the two date helpers next door say which helper
        // refused and what it was handed. The refusal is the same sentence they
        // use, since it is the same fact about the same value.
        if (Number.isNaN(held)) {
            throw refuse('urlencode(): ' + shown(value) + ' is not a date');
        }

        return encodeURIComponent(new Date(held).toISOString());
    }

    if (mapping(value)) {
        const pairs = new URLSearchParams();

        for (const [key, one] of pyEntries(value)) {
            pairs.append(__pybridge.str(key), __pybridge.str(one));
        }

        return pairs.toString();
    }

    // Everything else is a value, and a value is what Python prints of it. None
    // is the one exception the whole set shares: absence encodes to nothing,
    // which `__pybridge.str` already answers with an empty string.
    return encodeURIComponent(__pybridge.str(value));
}

// **Called by name as well as by position.** The README writes these signatures
// the way Python writes them — `tojson(value, indent=None)`, `batch(xs, n)` —
// and an author writes what the documentation shows. Nothing read the keywords.
//
// They do arrive: Brython hands a keyword call a trailing object carrying,
// under its symbol `$B.KW`, an array whose first entry holds the literal
// keywords and whose rest are the dicts a `**` spread contributed. Dropping it was the worst of the
// three behaviours this project names: `tojson(rows, indent=2)` wrote
// unindented JSON and said nothing, and `batch(rows, n=2)` refused the author
// for a size they had just given.
//
// The names are ours, which is the whole reason this is fixable here: a
// JavaScript function carries no parameter names to place them by.
//
// **Written the way Python writes a signature**, which is also the way the
// README shows it: a name alone has to be given, a name carrying a default does
// not. The table used to hold the names and nothing else, so it could say which
// parameters exist and not which a call must fill — and the refusal below had
// to hedge with *at most* where CPython says *from 1 to 2*. They are one fact
// about a signature, and they are written in one place now.
//
// `fn.length` cannot stand in for it: these are JavaScript functions whose
// optional parameters are declared like every other one, so `tojson.length` is
// 2 and `date.length` is 4.
const KEYWORDS = {
    tojson: ['value', 'indent=None'],
    from_json: ['text'],
    batch: ['xs', 'n', 'fill=None'],
    date: ['value', 'style=None', 'clock=None', 'locale=None'],
    fromnow: ['value', 'locale=None'],
    slugify: ['text'],
    striptags: ['html'],
    urlencode: ['value']
};

// CPython's own way of listing them: `'a'`, then `'a' and 'b'`, then
// `'a', 'b', and 'c'` with the comma before the `and`.
const listed = (names) => {
    const quoted = names.map((one) => `'${one}'`);

    if (quoted.length < 3) return quoted.join(' and ');

    return `${quoted.slice(0, -1).join(', ')}, and ${quoted[quoted.length - 1]}`;
};

// The keywords of a call, which Brython hands over as a trailing object
// carrying them under its own symbol, `$B.KW`: no argument an author passes, a
// Python dict or a JavaScript object, can carry that key.
const keywordsOf = (args) => args[args.length - 1]?.[globalThis.__BRYTHON__.KW] ?? null;

// A name the helper does not take is an error, not something to ignore: the
// spelling is the only thing the author can have got wrong, and Python says so
// too.
const byName = (fn, signature) => {
    // The name a caller writes, and where the optional ones start. Python puts
    // every default after every required parameter, so the boundary is an
    // index: `findIndex` reads it off the table instead of counting, and cannot
    // answer two if the table is ever written out of order.
    const names = signature.map((one) => one.split('=')[0]);
    const optional = signature.findIndex((one) => one.includes('='));
    const needed = optional === -1 ? names.length : optional;
    const takes = `It takes ${signature.join(', ')}.`;

    const wrapped = (...args) => {
        const kw = keywordsOf(args);
        const given = kw === null ? [...args] : args.slice(0, -1);

        // **A fixed Python signature does not become permissive because what
        // implements it is a JavaScript function.** JavaScript drops an argument
        // it has no parameter for and says nothing, so `slugify("a", "b")` read
        // as a correct call and the second word vanished.
        if (given.length > names.length) {
            // CPython's own wording, both of them: a signature with no default
            // says how many it takes, one with a default says the range.
            const counted =
                needed === names.length
                    ? `${names.length} positional argument${names.length === 1 ? '' : 's'}`
                    : `from ${needed} to ${names.length} positional arguments`;

            throw refuse(`${fn.name}() takes ${counted} but ${given.length} were given. ${takes}`);
        }

        // Which positions the call has already filled. Without this a keyword
        // **overwrote** what position had put there — `batch(rows, 2, n=3)`
        // grouped by three and said nothing, which is a wrong answer out of a
        // call the author got wrong and was never told about. Python raises.
        const filled = new Set(given.keys());

        for (const carrier of kw ?? []) {
            for (const [key, value] of pyEntries(carrier)) {
                // A subclass of str names the argument by the value it holds.
                const name = written(key);
                const at = names.indexOf(name);

                if (at === -1) {
                    throw refuse(`${fn.name}(): no argument named ${name}. ${takes}`);
                }

                // The same name twice is the `**` spread's case as much as the
                // plain one: `tojson(rows, indent=2, **{"indent": 4})` is two
                // values for one parameter, spelled two ways.
                if (filled.has(at)) {
                    throw refuse(`${fn.name}() got multiple values for argument '${name}'`);
                }

                filled.add(at);
                given[at] = value;
            }
        }

        // **What the table could not say before.** It named the parameters and
        // not which of them a call has to fill, so an omission reached the
        // helper as `undefined` and was read there as absence: `slugify()`
        // answered the empty string and `tojson(indent=2)` wrote `null`, both
        // without a word, out of a call whose missing argument is the only
        // thing wrong with it.
        //
        // The *positions*, never the values: `None`, `False`, `0` and the empty
        // string are arguments that were given, and two of them are what an
        // author writes on purpose — `tojson(None)` is `null` and means it.
        const missing = names.slice(0, needed).filter((_, at) => !filled.has(at));

        if (missing.length) {
            throw refuse(
                `${fn.name}() missing ${missing.length} required positional ` +
                    `argument${missing.length === 1 ? '' : 's'}: ${listed(missing)}`
            );
        }

        return fn(...given);
    };

    // The name and the arity stay the helper's own: a refusal quotes the name,
    // and `length` is what a caller reads to learn what a function takes.
    Object.defineProperties(wrapped, {
        name: { value: fn.name, configurable: true },
        length: { value: fn.length, configurable: true }
    });

    return wrapped;
};

// What the generated script binds. One object, one prefixed import, and the keys
// are the Python spellings so `injected.cjs` names them the way an author does.
export const helpers = Object.fromEntries(
    Object.entries({
        tojson,
        from_json,
        batch,
        date,
        fromnow,
        slugify,
        striptags,
        urlencode
    }).map(([name, fn]) => [name, byName(fn, KEYWORDS[name])])
);
