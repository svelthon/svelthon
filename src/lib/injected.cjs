'use strict';

// Data, and deliberately on its own: `compile.cjs` boots a Brython interpreter
// the moment it is required, so anything that only wants to read this list
// (a test, a tool) would be starting one for nothing, and a second one in a
// process that already has one fails outright.

// Everything the compiler publishes into a module's namespace, in one place:
// the counterpart of JS_RESERVED in compile.cjs, and readable the same way.
//
// Two rules, not one.
//
// A **helper** is skipped when the module already declares a name of that
// spelling: the author's own wins, exactly as a Python module that defines
// `list` shadows the builtin and loses it. `date` is the likeliest, for a
// variable holding a date, the most natural name there is.
//
// A **locked** name is refused outright. These are not builtins, they are
// Svelthon's own words: redefining `effect` is closer to redefining `def` than
// to shadowing `list`, and a reader who meets it can no longer read the file.
// Svelte draws the same line: `$state` and `$effect` cannot be redefined at all,
// the `$` prefix being reserved inside a component. The refusal is loud and
// names the culprit; winning in silence would be the worst of the three
// behaviours.
//
// The filter is what makes that true, and it is not optional: these are bound
// after the author's own names, onto the same prototype, so without it the
// compiler's binding silently replaces theirs.
// The one value a component computes for an injected name rather than reading
// it lazily, held here so the emitted line and the accessor cannot drift apart.
const PROPS_ID = '__props_id';

const INJECTED = [
    // The decorators only mark; the compiler has read them off the AST already.
    { name: 'derived', value: '() => (f) => f', locked: true },
    { name: 'bindable', value: '() => (v) => v', locked: true },
    // `@export` is what Svelte writes as `export function focus()`: the one
    // thing a parent can reach on a child that is not a prop. It marks the
    // function and nothing else, so a component exposes nothing unless it says
    // so, exactly as theirs does.
    { name: 'export', value: '() => (f) => f', component: true, locked: true },
    // `inspect(count, message)` is read off the AST like the decorators above;
    // the identity is what lets Python run the call it really makes.
    { name: 'inspect', value: '() => (f) => f', component: true, locked: true },

    // `inspect_with(log, count, message)` is `$inspect(…).with(fn)`. Their form
    // chains, which Python cannot spell: `with` is a keyword, and `with=` is
    // not an argument name either. A keyword argument would cost a parser:
    // `$inspect` is variadic, so pulling one named argument
    // out of the list means splitting the source text at depth zero. Taking the
    // callable *first* needs no parsing at all, since the split happens on the
    // evaluated list, where position is reliable, and it is what Python does
    // whenever position stops being enough: `map(fn, *iterables)`,
    // `filter(fn, it)`, `reduce(fn, it)`.
    { name: 'inspect_with', value: '() => (f) => f', component: true, locked: true },

    // `effect` carries `pre` because Python really applies the decorator at run
    // time: `@effect.pre` reads the attribute before calling it, and an identity
    // without one would raise before the compiler's own wiring ever ran.
    {
        name: 'effect',
        value: '() => Object.assign((f) => f, { pre: (f) => f, root: (f) => f })',
        locked: true
    },

    // The two bridges, each way. `to_py` is what makes `.get()`, `.items()`
    // and `isinstance(x, dict)` work on something that only ever crossed from
    // JavaScript, `await res.json()` above all.
    { name: 'to_js', value: '() => __plainData' },
    { name: 'to_py', value: '() => __pyData' },

    // Jinja's `|tojson`, under its own word: a body, an embedded payload, a
    // data attribute. It keeps the template's spelling rather than the shape of
    // the two above, because it is the only one of the three an author writes
    // every day. Those are last-resort converters for reaching into `js.` by
    // hand, and the framework already converts what crosses its own boundaries.
    //
    // `json.dumps` cannot stand in for it: Brython leaves a class instance
    // untouched, so the dump walks the raw object. This is `to_js` with the
    // dump attached.
    { name: 'tojson', value: '() => __helpers.tojson' },

    // The mirror of the line above, and built the same way: this is `to_py`
    // with the parse attached.
    { name: 'from_json', value: '() => __helpers.from_json' },

    // The inbound bridge: the JavaScript globals, as they are.
    { name: 'js', value: '() => globalThis' },

    // Jinja's `|batch(3)`, kept under its own name because that is the word a
    // Django or Flask author searches for. It is the one grouping an index
    // cannot give you: a real <table> needs its <tr>s, and JavaScript has no
    // equivalent at all.
    //
    // A list of lists, not a lazy iterator: an `{#each}` reads its rows again on
    // every update, and an iterator would come back empty the second time,
    // silently, with the table simply gone. The third argument pads the last
    // row, which is what aligns one; positional, because a keyword argument does
    // not survive the call into JavaScript.
    //
    // `None` there means *no padding*, not "pad with None", the rule every
    // helper here follows, since None is an object and would otherwise sail
    // through an `!== undefined` test and be rendered as a cell.
    { name: 'batch', value: '() => __helpers.batch' },

    // Django's `|date`, under Django's word, with the platform's behaviour
    // behind it, which is the rule the whole set follows: the keyword guides
    // someone arriving from Jinja, what they get is Svelte's.
    //
    // So no format letters (`d/m/Y`): `Intl` takes four styles and answers in
    // the reader's own language, which Django's codes never do. A value is
    // whatever a component actually receives: an ISO string, a date alone, a
    // timestamp, a JavaScript `Date`.
    //
    // `locale` is the last argument, and matters most under server rendering:
    // without it the server formats in *its* language and the browser
    // reformats in the visitor's, which Svelte reports as a hydration mismatch.
    { name: 'date', value: '() => __helpers.date' },

    // Django's `|timesince` and `|timeuntil` in one, which is why it carries
    // neither word: `Intl` formats a *signed* gap, so the direction is in the
    // value rather than in the name. `fromnow` is the JavaScript world's word
    // for it, moment and dayjs both spell it that way, and it stays true in
    // both directions where "since" would lie half the time.
    //
    // It is also the one helper here that Django could not have had at all. A
    // rendered page is finished, so "3 minutes ago" is true once and then wrong;
    // a component stays on screen, and this one keeps itself right.
    //
    // Reading it registers the block with a shared clock, and the delay asked
    // for is what the *display* needs: a second while it counts seconds, an
    // hour once it counts days. So it slows down on its own as a date ages,
    // which is why nothing has to switch it off.
    { name: 'fromnow', value: '() => __helpers.fromnow' },

    // Django's `|slugify`: a title made into a URL segment or an anchor id.
    //
    // One rule, no option, and it goes all the way: normalise, lowercase, keep
    // every letter, digit and mark, turn the rest into a dash. Django folds
    // accents to ASCII and drops what will not fold, which needs
    // `allow_unicode=True` to stop destroying text, and even then it is a half
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
    { name: 'slugify', value: '() => __helpers.slugify' },

    // Jinja's `|striptags`: HTML shown as text, an excerpt from a feed, a
    // preview of an imported document, content nobody here wrote.
    //
    // The browser's own parser does it, and nothing else does it correctly. The
    // regex Django and Jinja ship leaves entities undecoded (`caf&eacute;`),
    // lets markup escape through an attribute holding a `>`, and drops the tags
    // around a `<script>` while keeping its source. Django's documentation warns
    // that the output is not safe, and it is not even right.
    //
    // Which is why there is no fallback: off a browser this returns nothing
    // rather than something wrong. A first render shows less and then shows the
    // text, instead of showing `caf&eacute;` and correcting it. A page that
    // needs the text on the server should strip it where the data is prepared.
    //
    // Whitespace is collapsed, as Jinja does. Neither inserts a separator
    // between blocks: `<p>a</p><p>b</p>` is `ab` there too.
    { name: 'striptags', value: '() => __helpers.striptags' },

    // The word all three engines use, Liquid, Django and Jinja alike, for the one
    // thing a template genuinely does with a URL: build one. Decoding is an
    // *input* operation and belongs before the template; only Liquid ships a
    // decoder, because a Shopify theme has no code in front of it.
    //
    // Jinja's shape: a string, or a mapping that becomes a whole query string.
    // Not Jinja's behaviour, and not Django's either: both leave `/` unquoted,
    // which quietly turns `/tag/{urlencode(t)}` into two path segments. Jinja
    // states a reason for it ("HTTP servers treat / and %2F equivalently in
    // paths") and the reason is untrue: Apache answers 404 on an encoded slash
    // unless AllowEncodedSlashes is on, nginx decodes it, and the two differ by
    // design.
    //
    // Jinja does not even agree with itself: `|urlencode("a/b")` yields `a/b`
    // while `|urlencode({"p": "a/b"})` yields `p=a%2Fb`, because the two forms
    // reach different helpers. Escaping in both is the only reading that holds.
    { name: 'urlencode', value: '() => __helpers.urlencode' },

    // Context belongs to a component instance; a plain module has none. It is
    // per subtree, where a store is per application, and it is the only
    // per-request-safe place to put state under server rendering. Both must be
    // called while an instance initialises, which is exactly when the Python
    // module body runs.
    //
    // Either end may be JavaScript's, so a value crosses as it does at every
    // other door (`__pybridge.provide` and `provided`): set, a scalar
    // becomes JavaScript's own and a callable one JavaScript can call; read, a
    // number becomes Python's, an absence None, a JavaScript function one
    // Python can call, and what Python set, a callable or a scalar of its own
    // class, is itself again. A container
    // keeps its identity both ways. The key is a key as a dict has one, the
    // way `{#key}` makes it (`__pybridge.key`): a number is JavaScript's own,
    // so `0.5` finds what `setContext(0.5, …)` set, and `1`, `1.0` and `True`
    // are one key, while two NaN are two.
    {
        name: 'set_context',
        value: '() => (key, value) => __pybridge.provide(__setContext, __pybridge.key(key), value)',
        component: true
    },
    {
        name: 'get_context',
        value: '() => (key) => __pybridge.provided(__getContext, __pybridge.key(key))',
        component: true
    },

    // `$props.id()`, whose name follows theirs the way `set_context` follows
    // `setContext`. It is not a prop, the parent never passes it, but a reader
    // who meets the problem will find it under that name in Svelte's own docs.
    //
    // The rune may only be called at the top level of a component, never from a
    // getter or a function, so the value cannot be produced lazily like the
    // others: `emitted` names the line the preamble adds, and it is added only
    // when the generated code shows the name being read.
    {
        name: 'props_id',
        value: `() => () => ${PROPS_ID}`,
        component: true,
        whenRead: true,
        emitted: `const ${PROPS_ID} = $props.id();`
    },

    // `$host()`, the element a component is mounted as, when it is compiled as
    // a custom element by `<svelte:options customElement="…">`. It is the only
    // way out: a custom element speaks to the page through DOM events, not
    // props, so without it a Python component could receive and render but never
    // answer.
    //
    // Bound only where it is read, because Svelte refuses `$host()` at compile
    // time in a component that is not a custom element. Unlike `props_id` it may
    // be called from anywhere, so the value stays lazy like the rest.
    { name: 'host', value: '() => () => $host()', component: true, whenRead: true }
];

module.exports = { INJECTED };
