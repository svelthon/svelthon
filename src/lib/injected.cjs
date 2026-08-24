'use strict';

// Data, and deliberately on its own: `compile.cjs` boots a Brython interpreter
// the moment it is required, so anything that only wants to read this list —
// a test, a tool — would be starting one for nothing, and a second one in a
// process that already has one fails outright.

// Everything the compiler publishes into a module's namespace, in one place —
// the counterpart of JS_RESERVED in compile.cjs, and readable the same way.
//
// One rule for all of them: an injection is skipped when the module already
// declares a name of that spelling. The author's own always wins, exactly as a
// Python module that defines `list` shadows the builtin — and loses it.
//
// The filter is what makes that true, and it is not optional: these are bound
// after the author's own names, onto the same prototype, so without it the
// compiler's binding silently replaces theirs.
const INJECTED = [
    // The decorators only mark; the compiler has read them off the AST already.
    { name: 'derived', value: '() => (f) => f' },
    { name: 'bindable', value: '() => (v) => v' },
    { name: 'effect', value: '() => (f) => f' },

    // The outbound bridge: a Python value made readable from JavaScript.
    { name: 'to_js', value: '() => plainData' },
    { name: 'to_python', value: '() => pyArg' },

    // Jinja's `|tojson`, under its own word: a body, an embedded payload, a
    // data attribute. It keeps the template's spelling rather than the shape of
    // the two above, because it is the only one of the three an author writes
    // every day — those are last-resort converters for reaching into `js.` by
    // hand, and the framework already converts what crosses its own boundaries.
    //
    // `json.dumps` cannot stand in for it: Brython leaves a class instance
    // untouched, so the dump walks the raw object. This is `to_js` with the
    // dump attached.
    // A non-numeric indent is dropped rather than passed on: Python's None is an
    // object, and `JSON.stringify(v, null, None)` would quietly indent with it.
    {
        name: 'tojson',
        value: '() => (v, indent) => JSON.stringify(plainData(v), null, typeof indent === "number" ? indent : undefined)'
    },

    // The inbound bridge: the JavaScript globals, as they are.
    { name: 'js', value: '() => globalThis' },

    // Jinja's `|batch(3)`, kept under its own name because that is the word a
    // Django or Flask author searches for. It is the one grouping an index
    // cannot give you: a real <table> needs its <tr>s, and JavaScript has no
    // equivalent at all.
    //
    // Python has `itertools.batched`, and it is not an option: *any* import of
    // the standard library ships its whole transitive closure, measured at
    // 2.9 MB for this one — `operator`, `functools`, `collections`, and from
    // there `pdb`, `pydoc`, `argparse`, `tarfile`.
    //
    // A list of lists, not a lazy iterator: read twice, `batched` comes back
    // empty the second time, silently. The third argument pads the last row,
    // which is what aligns a table and what `batched` will not do; positional,
    // because a keyword argument does not survive the call into JavaScript.
    //
    // `None` there means *no padding*, not "pad with None" — the rule every
    // helper here follows, since None is an object and would otherwise sail
    // through an `!== undefined` test and be rendered as a cell.
    {
        name: 'batch',
        value: `() => (xs, size, fill) => {
            if (!Number.isInteger(size) || size < 1) {
                throw new Error('batch(): size must be an integer of at least one');
            }

            const items = __pybridge.seq(xs);
            const out = [];

            for (let at = 0; at < items.length; at += size) {
                const row = items.slice(at, at + size);
                if (fill !== undefined && fill !== NONE) while (row.length < size) row.push(fill);
                out.push(__pybridge.list(row));
            }

            return __pybridge.list(out);
        }`
    },

    // Django's `|date`, under Django's word — and the platform's behaviour
    // behind it, which is the rule the whole set follows: the keyword guides
    // someone arriving from Jinja, what they get is Svelte's.
    //
    // So no format letters (`d/m/Y`): `Intl` takes four styles and answers in
    // the reader's own language, which Django's codes never do. A value is
    // whatever a component actually receives — an ISO string, a date alone, a
    // timestamp, a JavaScript `Date`.
    //
    // `locale` is the last argument, and matters most under server rendering:
    // without it the server formats in *its* language and the browser
    // reformats in the visitor's, which Svelte reports as a hydration mismatch.
    {
        name: 'date',
        value: `() => (value, dateStyle, timeStyle, locale) => {
            const at = value instanceof Date ? value : new Date(value);

            if (Number.isNaN(at.getTime())) {
                throw new Error('date(): ' + JSON.stringify(value) + ' is not a date');
            }

            // A string, or absent. Python's None is an *object*, so testing
            // against undefined would hand Intl a Brython singleton and fail on
            // a value the author wrote as "nothing".
            const options = {};

            if (typeof dateStyle === 'string') options.dateStyle = dateStyle;
            if (typeof timeStyle === 'string') options.timeStyle = timeStyle;
            if (options.dateStyle === undefined && options.timeStyle === undefined) {
                options.dateStyle = 'medium';
            }

            const language = typeof locale === 'string' ? locale : undefined;

            return new Intl.DateTimeFormat(language, options).format(at);
        }`
    },

    // Django's `|timesince` and `|timeuntil` in one, which is why it carries
    // neither word: `Intl` formats a *signed* gap, so the direction is in the
    // value rather than in the name. `fromnow` is the JavaScript world's word
    // for it — moment and dayjs both spell it that way — and it stays true in
    // both directions where "since" would lie half the time.
    //
    // It is also the one helper here that Django could not have had at all. A
    // rendered page is finished, so "3 minutes ago" is true once and then wrong;
    // a component stays on screen, and this one keeps itself right.
    //
    // Reading it registers the block with a shared clock, and the delay asked
    // for is what the *display* needs — a second while it counts seconds, an
    // hour once it counts days. So it slows down on its own as a date ages,
    // which is why nothing has to switch it off.
    {
        name: 'fromnow',
        value: `() => (value, locale) => {
            const at = value instanceof Date ? value : new Date(value);

            if (Number.isNaN(at.getTime())) {
                throw new Error('fromnow(): ' + JSON.stringify(value) + ' is not a date');
            }

            const UNITS = [
                ['year', 31536000], ['month', 2592000], ['week', 604800],
                ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]
            ];

            const gap = (at.getTime() - Date.now()) / 1000;
            const size = Math.abs(gap);
            const [unit, span] = UNITS.find(([, s]) => size >= s) || UNITS[UNITS.length - 1];

            // When the shown number next changes: one whole unit from the last
            // boundary crossed, never the fixed beat of a generic timer.
            ticking(span * 1000 - ((size * 1000) % (span * 1000)));

            const language = typeof locale === 'string' ? locale : undefined;

            return new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
                .format(Math.round(gap / span), unit);
        }`
    },

    // Django's `|slugify`: a title made into a URL segment or an anchor id.
    //
    // One rule, no option, and it goes all the way: normalise, lowercase, keep
    // every letter, digit and mark, turn the rest into a dash. Django folds
    // accents to ASCII and drops what will not fold, which needs
    // `allow_unicode=True` to stop destroying text — and even then it is a half
    // measure, since a URL carries unicode either way. Keeping `é` while keeping
    // `本` is the only reading of "support unicode" that holds together.
    //
    // Two details the rule does not survive without.
    //
    // NFC, not NFD: `é` written as one code point and as `e` + a combining acute
    // look the same and must give the same URL. Composing first is what makes
    // two identical titles one slug.
    //
    // And marks are *kept*, which is not decoration: a Devanagari vowel sign is
    // a combining mark with no composed form, so dropping marks turns
    // `हिन्दी भाषा` into `ह-न-द-भ-ष-`. That is not folding a word, it is
    // shredding it.
    {
        name: 'slugify',
        value: `() => (value) => __pybridge.str(value)
            .normalize('NFC')
            .toLowerCase()
            .replace(/[^\\p{L}\\p{N}\\p{M}_]+/gu, '-')
            .replace(/^-+|-+$/g, '')`
    },

    // Jinja's `|striptags`: HTML shown as text — an excerpt from a feed, a
    // preview of an imported document, content nobody here wrote.
    //
    // The browser's own parser does it, and nothing else does it correctly. The
    // regex Django and Jinja ship leaves entities undecoded (`caf&eacute;`),
    // lets markup escape through an attribute holding a `>`, and drops the tags
    // around a `<script>` while keeping its source. Django's documentation warns
    // that the output is not safe; measured, it is not even right.
    //
    // Which is why there is no fallback: off a browser this returns nothing
    // rather than something wrong. A first render shows less and then shows the
    // text, instead of showing `caf&eacute;` and correcting it — and a page that
    // needs the text on the server should strip it where the data is prepared.
    //
    // Whitespace is collapsed, as Jinja does. Neither inserts a separator
    // between blocks: `<p>a</p><p>b</p>` is `ab` there too.
    {
        name: 'striptags',
        value: `() => (value) => {
            if (typeof DOMParser === 'undefined') return '';

            const text = new DOMParser()
                .parseFromString(__pybridge.str(value), 'text/html')
                .body.textContent;

            return (text || '').replace(/\\s+/g, ' ').trim();
        }`
    },

    // The word all three engines use — Liquid, Django and Jinja — for the one
    // thing a template genuinely does with a URL: build one. Decoding is an
    // *input* operation and belongs before the template; only Liquid ships a
    // decoder, because a Shopify theme has no code in front of it.
    //
    // Jinja's shape: a string, or a mapping that becomes a whole query string.
    // Not Jinja's behaviour, and not Django's either — both leave `/` unquoted,
    // which quietly turns `/tag/{urlencode(t)}` into two path segments. Jinja
    // states a reason for it ("HTTP servers treat / and %2F equivalently in
    // paths") and the reason is untrue: Apache answers 404 on an encoded slash
    // unless AllowEncodedSlashes is on, nginx decodes it, and the two differ by
    // design.
    //
    // Jinja does not even agree with itself: `|urlencode("a/b")` yields `a/b`
    // while `|urlencode({"p": "a/b"})` yields `p=a%2Fb`, because the two forms
    // reach different helpers. Escaping in both is the only reading that holds.
    {
        name: 'urlencode',
        value: `() => (value) => {
            if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
                const pairs = new URLSearchParams();

                for (const key of Object.keys(value)) pairs.append(key, __pybridge.str(value[key]));

                return pairs.toString();
            }

            return encodeURIComponent(__pybridge.str(value));
        }`
    },

    // Context belongs to a component instance; a plain module has none.
    { name: 'set_context', value: '() => setContext', component: true },
    // A missing key is `undefined` in Svelte; Python expects None.
    { name: 'get_context', value: '() => (key) => getContext(key) ?? NONE', component: true }
];

module.exports = { INJECTED };
