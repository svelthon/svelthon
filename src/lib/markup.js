// The markup half of the preprocessor: turning a Svelte template's expressions
// into Python. Pure string work, and deliberately free of any Node import: the
// browser playground compiles components client-side and needs exactly this,
// while the file next door needs `fs` and `path` and cannot be loaded there.

// Find the '}' closing the block that opens at `start`, ignoring braces inside
// string literals.
function closingBrace(source, start) {
    let depth = 0;
    let quote = null;

    for (let i = start; i < source.length; i++) {
        const c = source[i];

        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
            continue;
        }

        if (c === '"' || c === "'" || c === '`') quote = c;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) return i;
    }

    return -1;
}

// The bracket closing the one that opens at `start`, whichever it is, ignoring
// brackets inside string literals. `(` for a group or a call, `[` for the
// subscript a walrus may aim at.
function closingPair(source, start) {
    const open = source[start];
    const close = open === '(' ? ')' : ']';
    let depth = 0;
    let quote = null;

    for (let i = start; i < source.length; i++) {
        const c = source[i];

        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
            continue;
        }

        if (c === '"' || c === "'") quote = c;
        else if (c === open) depth++;
        else if (c === close && --depth === 0) return i;
    }

    return -1;
}

// Walk `text` at depth zero, ignoring anything inside a string, a bracket or a
// parenthesis. Used to find where an expression ends (a comma between two
// arguments, or the `then` of an await block) without parsing Python.
function atTopLevel(text, visit) {
    let depth = 0;
    let quote = null;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];

        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
            continue;
        }

        if (c === '"' || c === "'") quote = c;
        else if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
        else if (depth === 0 && visit(i) === true) return i;
    }

    return -1;
}

// `f(a, b)` → ['a', 'b'], with a comma inside a literal or a call left alone.
function arguments_(text) {
    const parts = [];
    let from = 0;

    atTopLevel(text, (i) => {
        if (text[i] !== ',') return false;
        parts.push(text.slice(from, i));
        from = i + 1;
        return false;
    });

    const last = text.slice(from);
    if (last.trim() || parts.length) parts.push(last);

    return parts;
}

const WALRUS_NAME = /^\s*([A-Za-z_]\w*)/;
const WALRUS_ARROW = /^\s*:=\s*/;

// What a walrus aims at, which is more than Python's own grammar allows it.
//
// PEP 572 restricts the target to a single name; JavaScript's `=` takes a name,
// an attribute and a key alike, and every handler upstream writes one of the
// three. Svelthon's dot already finds a key rather than only an attribute, both
// reading a template expression and writing through `bind:`. The walrus was the
// one place that decision had not been carried, which is why `spring.target`
// needed `setattr` while nothing else did.
//
// Returns the name for the plain form, or the object and key for the other two,
// with `subscript` telling which was written. Null when there is no walrus here.
function walrusTarget(text) {
    const found = text.match(WALRUS_NAME);
    if (!found) return null;

    let index = found[0].length;
    let object = null;
    let key = null;
    let subscript = false;

    // The *last* step is the one being assigned; everything before it is the
    // object to assign into. `a.b.c := 1` writes `c` on `a.b`.
    while (index < text.length) {
        if (text[index] === '.') {
            const attribute = text.slice(index + 1).match(WALRUS_NAME);
            if (!attribute) return null;

            object = text.slice(0, index).trim();
            key = `"${attribute[1]}"`;
            subscript = false;
            index += 1 + attribute[0].length;
        } else if (text[index] === '[') {
            const close = closingPair(text, index);
            if (close === -1) return null;

            const inner = text.slice(index + 1, close).trim();

            // A slice is a target Python assigns to and an expression it has no
            // spelling for: `items[1:]` cannot be passed as a key. Rather than
            // emit something that will not parse, leave the whole walrus alone
            // and let Python report it in its own words.
            if (atTopLevel(inner, (i) => inner[i] === ':') !== -1) return null;

            object = text.slice(0, index).trim();
            key = inner;
            subscript = true;
            index = close + 1;
        } else break;
    }

    const arrow = text.slice(index).match(WALRUS_ARROW);
    if (!arrow) return null;

    return {
        name: object === null ? found[1] : null,
        object,
        key,
        subscript,
        length: index + arrow[0].length
    };
}

// `(name := value)` is the one assignment Python allows inside an expression,
// and therefore the only one a `lambda` can hold, which is exactly what a
// handler needs, since `onclick={() => (open = !open)}` has no Python twin.
//
// Its own meaning is useless here: PEP 572 binds in the enclosing *function*,
// and a lambda is one, so the write dies with the call, silently, which is
// worse than an error. A template is not plain Python either; it already has
// `{#if}`, `{:else}` and four implicit wrappers. So here the walrus writes the
// component's name, through the namespace and therefore through the signal.
//
// Only the parenthesised form, which is the one Python's own grammar forces in
// a lambda. `f(x := 1)` keeps its meaning: a temporary the call consumes.
export function walrus(expression) {
    let out = '';
    let index = 0;
    let quote = null;

    while (index < expression.length) {
        const char = expression[index];

        if (quote) {
            out += char;
            if (char === '\\') out += expression[++index] ?? '';
            else if (char === quote) quote = null;
            index++;
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            out += char;
            index++;
            continue;
        }

        // Only a *grouping* parenthesis, which is the form Python's grammar
        // forces in a lambda. One that opens a call belongs to the callee, and
        // consuming it rewrote `f(x := 1)` as `f__assign("x", 1)`, a call to a
        // name that does not exist, so the handler did nothing at all and said
        // nothing either. `f((x := 1))` is the form that assigns.
        const grouping = !/[\w)\]"']$/.test(out);

        if (char === '(' && grouping) {
            // Each element of the group, not only the first. `(a := 1, b := 2)`
            // is the one expression Python has that assigns twice, and it is
            // what a handler needs: JavaScript reaches for its comma operator
            // there, which exists for the same reason: a `for` clause takes one
            // expression and you want two. Reading only the start of the group
            // took `1, b := 2` for the value and lost every assignment but the
            // first, silently.
            //
            // The parentheses are already required for a single assignment, so
            // the several-element form costs the author no new syntax.
            const close = closingPair(expression, index);
            const parts = close === -1 ? [] : arguments_(expression.slice(index + 1, close));

            if (parts.some((one) => walrusTarget(one))) {
                const written = parts.map((one) => {
                    const found = walrusTarget(one);
                    if (!found) return walrus(one).trim();

                    const value = walrus(one.slice(found.length));

                    // A name goes through the namespace, which is what makes the
                    // signal fire. An attribute or a key is written where it
                    // lives, by the same two calls Brython itself compiles an
                    // assignment to, so `inTemplate`, already in place for the
                    // read, applies its rule to the write for free.
                    return found.name
                        ? `__assign("${found.name}", ${value})`
                        : `${found.subscript ? '__setitem' : '__setattr'}(${found.object}, ${found.key}, ${value})`;
                });

                // One element was a grouping parenthesis and goes with it;
                // several are a tuple, and Python keeps it one.
                out += written.length > 1 ? `(${written.join(', ')})` : written[0];
                index = close + 1;
                continue;
            }
        }

        out += char;
        index++;
    }

    return out;
}

// Only the markup, never a <script> or <style> body: Python is full of braces
// (dict literals, f-strings) and rewriting them would be catastrophic.
//
// `transform` is given where its chunk starts, for a caller that needs to map
// what it finds back onto the original file rather than only rewrite it.
export function overMarkup(content, transform) {
    const blocks = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
    let out = '';
    let cut = 0;
    let block;

    while ((block = blocks.exec(content))) {
        out += transform(content.slice(cut, block.index), cut) + block[0];
        cut = block.index + block[0].length;
    }

    return out + transform(content.slice(cut), cut);
}

// `bind:` needs to read *and* write, which no single expression can do. Svelte
// takes a pair for exactly that, `bind:value={() => v, (n) => v = n}`, so the
// value is compiled twice: once as an expression, once as an assignment target.
// A bare name barely notices, being written the same way in both languages; what
// this buys is `bind:value={row.name}`, a member expression that used to be
// JavaScript's and silently missed a dict.
//
// Everything else that used to sit here (`use:`, the transition family,
// `class:`, `style:`) takes an ordinary *value*, and takes a Python one.
const DIRECTIVE = /^bind:/;

// `bind:group` refuses the pair: Svelte works out which inputs form one group
// from the *text* of the expression, and two anonymous functions have none. So it
// does not become a pair, it becomes an action, and the group stops needing an
// identity at all: each input computes its own `checked` from the same target.
//
// That is also what fixes it. Svelte's own version writes the value with a plain
// JavaScript assignment, which lands on the object but never reaches
// `$B.$setitem`, so nothing re-renders, not even Svelte's effect that unfills
// the others. Going through the pair puts the write back on Python's path.
const GROUP_DIRECTIVE = /^bind:group\b/;

// The shorthand: `bind:value` with no `={…}` is Svelte's way of writing
// `bind:value={value}`. Written that way it never reaches the pair above, since
// the scanner looks for an `=` and finds none, so Svelte binds its own `let` for
// the name instead, which is the raw signal cell rather than Python's. Reads
// then miss the namespace and writes never come back, and the first symptom is
// worse than either: `bind:files` with nothing chosen hands Python's `None`
// straight to a DOM property, which fails with `Failed to convert value to
// FileList`.
//
// So the shorthand is expanded before anything else looks at the tag, and the
// long form is the only one the rest of this pass has to know about.
const SHORTHAND = /\bbind:([A-Za-z_$][\w$]*)$/;

// The action the generated script defines for it. Named here and emitted there,
// like `__event`.
const GROUP_ACTION = '__group';

// The setter's parameter. Generated, so it only has to avoid the author's names.
const BOUND_VALUE = '__value';

// A handler takes a *callable*, and Python's is `lambda`. So its value is
// compiled as Python like everything else, and what the expression yields is
// wrapped for JavaScript: `pyHandler` reads the signature Brython recorded,
// trims the call to the arity the author declared and converts the arguments,
// which is what lets `lambda: choose(pep)` ignore the DOM event it is handed
// while `lambda e: read(e.target.value)` receives it.
const HANDLER = /^(?:on[a-z]|on:)/;

// The wrapper the generated script defines for handlers. Named here and emitted
// there, so the two have to agree: it exists to carry the component's line
// offset, which the markup pass runs too early to know.
const EVENT_WRAPPER = '__event';

// `class:many={…}` is read for truthiness, so it needs Python's: an empty list
// is false here and true in JavaScript, exactly as in `{#if}`.
const CLASS_DIRECTIVE = /^class:/;

// Names a block introduces, which are not module globals and must therefore be
// passed in as arguments.
const BLOCK_NAMES = {
    '#each': /\bas\s+([^()]*?)\s*(?:\(|$)/,
    '#snippet': /\w+\s*\(([^)]*)\)/,
    ':then': /^:then\s+(.+)$/,
    ':catch': /^:catch\s+(.+)$/
};

// The elements HTML closes by itself, which therefore open no body and no
// scope. A component is never one of them.
const VOID = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

const identifiers = (text) => [...text.matchAll(/[A-Za-z_]\w*/g)].map((m) => m[0]);

function declaredBy(inner) {
    const keyword = inner.trimStart().split(/[\s(]/)[0];
    const pattern = BLOCK_NAMES[keyword];
    if (!pattern) return [];

    const found = inner.trim().match(pattern);
    return found ? identifiers(found[1]) : [];
}

// `{#each xs as x, i (key)}`. The iterable is evaluated outside the block, so it
// is compiled before the block's names exist; the key is evaluated inside it.
// Both matter: a Python iterable that is not a list (a dict, a range, the
// result of .items()) has to become an array for Svelte to walk it.
// `for k, v in d.items()` is how Python unpacks, and `as (k, v)` is how it reads
// in a template. Svelte destructures with brackets, and a Python tuple *is* an
// array, so the two mean the same thing once the punctuation is translated.
function pattern(target) {
    const trimmed = target.trim();

    // Only what is explicitly parenthesised. A bare `x, i` is Svelte's item and
    // index, not a tuple: turning that into `[x, i]` would silently destructure
    // every indexed loop in the project.
    if (!trimmed.startsWith('(')) return trimmed;

    let depth = 0;
    let close = -1;

    for (let i = 0; i < trimmed.length && close === -1; i++) {
        if (trimmed[i] === '(') depth++;
        else if (trimmed[i] === ')' && --depth === 0) close = i;
    }

    if (close === -1) return trimmed;

    const inner = trimmed.slice(1, close).replace(/[()]/g, (one) => (one === '(' ? '[' : ']'));
    return `[${inner}]${trimmed.slice(close + 1)}`;
}

// The key that trails an `{#each}` target: `[target, key]`, or null when the line
// carries none.
//
// A key is an expression, so it holds parentheses of its own: a call, a builtin,
// a tuple. Matching it with `\(([^()]*)\)$` therefore failed on exactly those, and
// failed *silently*: the whole line was taken for the target, so the key travelled
// into the generated markup uncompiled, JavaScript in a template where nothing
// else is, and the names inside it were declared as the block's own. Measured
// before this existed: `(str(r.id))` reached the browser as `ReferenceError: str
// is not defined`, and a tuple key, which is how Python writes a composite one,
// could not be written at all.
//
// So the group is found by balance rather than by content, ignoring parentheses
// inside a string. Forward, not backwards: only a forward scan can tell an escaped
// quote from a real one.
function trailingKey(text) {
    let depth = 0;
    let quote = null;
    let opens = -1;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];

        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
            continue;
        }

        if (c === '"' || c === "'") quote = c;
        else if (c === '(') {
            if (depth === 0) opens = i;
            depth++;
        } else if (c === ')') {
            // Unbalanced: not something to guess at, and Svelte will report it.
            if (--depth < 0) return null;
            if (depth > 0) continue;

            // Only a group with nothing after it is the key. Anything trailing it
            // means the parentheses belonged to the target instead.
            if (text.slice(i + 1).trim()) continue;

            // And the part before has to be non-empty, or `as (statut, combien)`
            // (a tuple target) would read as a key with no target at all.
            return text.slice(0, opens).trim() ? [text.slice(0, opens), text.slice(opens + 1, i)] : null;
        }
    }

    return null;
}

function eachBlock(trimmed, declare, call) {
    const split = trimmed.match(/^#each\s+([\s\S]+?)\s+as\s+([\s\S]+)$/);

    // No `as`: nothing is declared, and there is no key to find either.
    if (!split) {
        const alone = trimmed.match(/^#each\s+([\s\S]+)$/);
        declare([]);
        return alone ? `{#each ${call(alone[1], '__seq')}}` : `{${trimmed}}`;
    }

    const keyed = trailingKey(split[2]);
    const target = pattern(keyed ? keyed[0] : split[2]);

    const iterable = call(split[1], '__seq');
    declare(identifiers(target));

    return `{#each ${iterable} as ${target}` + (keyed ? ` (${call(keyed[1], 'repr')})` : '') + '}';
}

// What Svelte's template language holds, named here so that anything else stops
// rather than crosses. The branch that used to end these three chains was a
// catch-all written for one case, `{@debug}` and `{#snippet}`, and it silently
// carried every construct nobody had thought about, leaving its expression as
// JavaScript inside a component that promised Python. Five of them were found
// one at a time before this list existed.
const BLOCKS = ['if', 'each', 'key', 'await', 'snippet'];
const CLAUSES = ['else', 'then', 'catch'];
// `{@…}` is read in two positions and the two sets do not overlap: Svelte places
// `{@attach}` inside a tag and the other three outside one. One shared list made
// every refusal name the very word the author had just written: `{@html x}` in
// a tag was refused by a sentence listing `html` among the tags it knows.
const TAGS = ['html', 'render', 'debug'];
const ATTACHMENTS = ['attach'];

// `{x = 2}` and `{y => x + 5}`: a name declared in the markup, with the two
// signs the script already uses and no third one invented.
//
// Svelte spells these `{let x = …}` and `{const y = $derived(…)}`, which are
// JavaScript keywords in a Python file. We keep our own, and the rule stays the
// one sentence it has always been: **a rune lives at the top level of the
// script, and in the markup**, the two places the compiler reads a
// declaration.
//
// `=` makes state here for the same reason it does at module level: there is no
// way to assign without it. The analogy with `x = 2` inside a `def`, which is an
// ordinary local, does not hold: the markup is not a Python scope, so there is
// no Python rule to inherit.
//
// And the powerful form costs nothing when nobody uses the power: measured on
// 5.56.9, a `$state.raw` that nothing writes to compiles to a bare binding,
// exactly as a `const` would. Svelte upgrades it to a signal only when a `bind:`
// writes to it.
//
// `$state.raw` and never `$state`: the latter deep-proxies, and a Brython object
// behind a JavaScript proxy fails its own type checks.
const DECLARED_NAME = /^[A-Za-z_]\w*$/;

// What `walrus()` emits for the plain form, read back so that a write aimed at a
// markup name can be refused rather than sent to the wrong scope.
const ASSIGNED = /__assign\("([A-Za-z_]\w*)"/g;

// The signs that end in `=` without being an assignment, plus the comparison.
const NOT_ASSIGNMENT = new Set(['=', '!', '<', '>', '+', '-', '*', '/', '%', '&', '|', '^', ':']);

function declaration(inner) {
    // The arrow first: `y => e` would otherwise be read as `y =` followed by a
    // stray `>`.
    const arrow = atTopLevel(inner, (i) => inner.startsWith('=>', i));

    if (arrow !== -1) {
        const name = inner.slice(0, arrow).trim();

        if (DECLARED_NAME.test(name)) {
            return { name, expression: inner.slice(arrow + 2), rune: 'derived' };
        }
    }

    const at = atTopLevel(
        inner,
        (i) => inner[i] === '=' && inner[i + 1] !== '=' && !NOT_ASSIGNMENT.has(inner[i - 1])
    );

    if (at !== -1) {
        const name = inner.slice(0, at).trim();

        if (DECLARED_NAME.test(name)) {
            return { name, expression: inner.slice(at + 1), rune: 'state' };
        }
    }

    return null;
}

const unknownTag = (trimmed, kind, known, at) =>
    new SyntaxError(
        `svelthon — \`{${trimmed}}\` is not a ${kind} Svelthon knows${at}; ` +
            `the ${kind}s are ${known.join(', ')}. A construct left unhandled would ` +
            `cross as JavaScript, so it is refused rather than passed through.`
    );

// Where a refusal happened, in the file the author is looking at.
//
// The compiler names a position on all sixteen of its refusals and the markup
// pass named one on none of them, because it never received a filename: the
// message said what was wrong and left the reader to grep. `walk()` was already
// holding the answer, since it keeps `region` on every `{…}` it reads, and threw
// it away one line later.
//
// `filename` and `start` go on the error object too, in Svelte's own shape, so
// vite-plugin-svelte and an editor can put the squiggle under the character
// rather than print a sentence.
function lineColumn(content, offset) {
    const before = content.slice(0, offset);
    const line = before.split('\n').length;

    return { line, column: offset - (before.lastIndexOf('\n') + 1), character: offset };
}

// A snippet's name belongs to the scope that *encloses* the block, and to the
// whole of it: Svelte hoists the declaration, so `<Card {row} />` may be written
// above the `{#snippet row(x)}` it names, measured, it compiles. One
// left-to-right walk cannot know a name it has not reached yet, so the markup is
// walked twice: once with a throwaway collector, to record which scope each
// snippet name belongs to, then for real with every scope seeded.
//
// The parameters are the other half and were already handled: `x` belongs
// *inside* the block, the name belongs outside it. That is the whole difference,
// and it is why `{#snippet row(x)}<b>{x}</b>{/snippet}` always worked while
// `<Card {row} />` did not.
// `where` is `{ filename, content, offset }`, and it is what a refusal needs to
// name a position: `markup` is one chunk of the file, `offset` is where that
// chunk starts, and `content` is the whole of it. Optional, since the playground
// and the range scan below compile a fragment that belongs to no file.
export function pythonExpressions(markup, collect, onPython, where) {
    const named = new Map();

    walk(markup, () => '__probe', undefined, new Map(), named, where);

    return walk(markup, collect, onPython, named, null, where);
}

function walk(markup, collect, onPython, seed, record, where) {
    let out = '';
    let index = 0;
    let inTag = false;
    let quote = null;
    let quotedAttribute = null;
    let region = null;

    // Scopes are numbered by the order they are opened in, which two walks of
    // the same markup agree on. The base scope, the component's own, is 0.
    let opened = 0;
    const ids = [0];
    const scopes = [[...(seed.get(0) || [])]];

    // The tag being read, so that its closing `>` knows what it closed.
    let tag = null;

    const push = (names) => {
        opened += 1;
        ids.push(opened);
        scopes.push([...(seed.get(opened) || []), ...names]);
    };

    // Never below the base scope: unbalanced markup is Svelte's to refuse, and
    // popping past the bottom here would lose the snippet names it holds.
    const pop = () => {
        if (scopes.length > 1) {
            scopes.pop();
            ids.pop();
        }
    };

    const inScope = () => [...new Set(scopes.flat())];

    // The `{` of the construct being read, as the author sees it. `region.start`
    // is the character after the brace, so this steps back onto it.
    const position = () =>
        where && region ? lineColumn(where.content, where.offset + region.start - 1) : null;

    // ` (src/App.svelte:14:6)`, or nothing when there is no file to name.
    const said = () => {
        const at = position();

        return at ? ` (${where.filename}:${at.line}:${at.column + 1})` : '';
    };

    // The same position, on the error object, in the shape Svelte's own
    // preprocessor errors carry.
    const refuse = (error) => {
        const at = position();

        if (at) {
            error.filename = where.filename;
            error.start = at;
            error.end = where && region ? lineColumn(where.content, where.offset + region.end + 1) : at;
        }

        return error;
    };

    // The block names an expression actually reads, rather than every name in
    // scope. Passing all of them was harmless until the markup could declare
    // one: Svelte then warns `state_referenced_locally` about a name the
    // expression never mentions, because it sees a tag-declared state read
    // outside a reactive position.
    //
    // It is the right shape anyway. `follow(x)` subscribes the reader to `x`,
    // and an expression that does not read `x` has no business depending on it.
    const mentioned = (expr) => {
        const names = new Set(identifiers(expr));

        return inScope().filter((one) => names.has(one));
    };

    // Where a template expression sits in the *source*, for a caller that needs
    // to point at it rather than compile it: the editor's highlighting above
    // all, which colours these ranges with the same parser as the `<script>`.
    //
    // The range is reported only when the text occurs exactly once inside its
    // own braces, so an ambiguous match like `{#each items as items}` yields no
    // range rather than the wrong one. A missing highlight is invisible; a
    // misplaced one teaches the reader something false.
    const locate = (expr) => {
        // `{}` has nothing to point at, and a zero-length range is the kind of
        // thing a consumer is entitled not to expect.
        if (!onPython || !region || !expr) return;

        const text = markup.slice(region.start, region.end);
        const at = text.indexOf(expr);

        if (at === -1 || at !== text.lastIndexOf(expr)) return;

        onPython(region.start + at, region.start + at + expr.length);
    };

    // `source` is what the author actually typed, when that differs from what
    // gets compiled: a handler goes through walrus() first, and a range has to
    // point at the text on screen rather than at the rewrite.
    const call = (expr, wrapper, source = expr) => {
        const trimmed = expr.trim();
        const args = mentioned(trimmed);

        locate(source.trim());
        const name = collect(trimmed, wrapper, args);

        // follow() on the block's own names: a row of an {#each} is a plain
        // JavaScript value, not a signal, so reading `it.label` registers
        // nothing by itself. This is what subscribes the row's block to the row.
        return `${name}(${args.map((arg) => `follow(${arg})`).join(', ')})`;
    };

    // The write half of a binding: the same text, compiled as an assignment
    // target rather than as an expression. No locate(): it is the same source
    // text the read half already reported, and a range must not be sent twice.
    const assign = (expr) => {
        const args = mentioned(expr.trim());
        const name = collect(expr.trim(), '', args, true);
        const rest = args.map((arg) => `follow(${arg})`);

        return `${name}(${[BOUND_VALUE, ...rest].join(', ')})`;
    };

    // A `bind:` whose target is a name the *markup* declared, a `{x = e}` or a
    // block's own alias, cannot go through the pair above. The generated `def`
    // receives that name as a parameter, so `x = value` would assign to the
    // parameter and the write would die with the call. Silently.
    //
    // Svelte already knows how to write those, so the directive is handed over
    // untouched. Measured on 5.56.9: a tag-declared `$state.raw` that nothing
    // writes to compiles to a bare binding, and Svelte upgrades it to a real
    // signal the moment a `bind:` targets it.
    const declaredHere = (expr) => {
        const name = expr.trim();

        return DECLARED_NAME.test(name) && inScope().includes(name);
    };

    // `(x := …)` writes through the namespace, which holds the module's names
    // and nothing else. A name the markup declared is not there, so the write
    // would land on a module name of the same spelling, creating one if it had
    // to. Silently, and in the wrong scope.
    //
    // Refused rather than supported: `bind:` writes those names already, and a
    // handler that wants to toggle something has the script for it. What is
    // missing is the ability to *write* a markup name from a handler, and no
    // corpus asks for it: measured, zero of 889 components.
    const refuseMarkupWalrus = (rewritten, source) => {
        for (const [, name] of rewritten.matchAll(ASSIGNED)) {
            if (!inScope().includes(name)) continue;

            throw refuse(
                new SyntaxError(
                    `svelthon — \`${name}\` is declared by the markup${said()}, and \`:=\` ` +
                        `writes the script's names, so \`{${source.trim()}}\` would write a ` +
                        `different \`${name}\`. Use \`bind:\` to write a name the markup ` +
                        `declared, or declare \`${name}\` in the script.`
                )
            );
        }
    };

    while (index < markup.length) {
        const char = markup[index];

        if (inTag) {
            if (quote) {
                // `class="badge {statut.lower()}"`, an interpolation inside a
                // quoted attribute value. Svelte concatenates it into a string,
                // so it renders like any other text and goes through __text.
                if (char === '{') {
                    const end = closingBrace(markup, index);

                    const named = quotedAttribute || '';

                    if (end !== -1 && !DIRECTIVE.test(named) && !HANDLER.test(named)) {
                        region = { start: index + 1, end };
                        out += `{${call(markup.slice(index + 1, end), '__text')}}`;
                        region = null;
                        index = end + 1;
                        continue;
                    }
                }

                if (char === quote) quote = null;
            } else if (char === '"' || char === "'") {
                quote = char;
                quotedAttribute = (out.match(/([^\s=]+)=$/) || [])[1];
            } else if (char === '{') {
                const end = closingBrace(markup, index);
                if (end !== -1) {
                    const attribute = out.match(/([^\s=]+)=$/);
                    const inner = markup.slice(index + 1, end);
                    const trimmed = inner.trim();

                    region = { start: index + 1, end };

                    if (attribute) {
                        // A binding becomes a read/write pair; `bind:group` is
                        // the one Svelte will not take a pair for and keeps its
                        // text. A handler is Python, and what it yields is made
                        // callable from JavaScript. Everything else, a
                        // component prop included, is Python.
                        if (GROUP_DIRECTIVE.test(attribute[1])) {
                            // The tag is never inspected: `type` and `value` are
                            // read off the node at run time, which is why this
                            // needs no lookahead over the attributes.
                            out = out.replace(/[^\s=]+=$/, '') +
                                `use:${GROUP_ACTION}={[${call(inner, '')}, (${BOUND_VALUE}) => ${assign(inner)}]}`;
                        } else if (DIRECTIVE.test(attribute[1])) {
                            out += declaredHere(inner)
                                ? `{${inner.trim()}}`
                                : `{() => ${call(inner, '__bound')}, (${BOUND_VALUE}) => ${assign(inner)}}`;
                        } else if (HANDLER.test(attribute[1])) {
                            // A handler is the one place a template expression
                            // is allowed to write: it runs on an event, not
                            // during a render, where Svelte rejects a write to
                            // state, and rightly so.
                            const rewritten = walrus(inner);

                            refuseMarkupWalrus(rewritten, inner);
                            out += `{${EVENT_WRAPPER}(${call(rewritten, '', inner)})}`;
                        } else if (CLASS_DIRECTIVE.test(attribute[1])) {
                            out += `{${call(inner, '__truthy')}}`;
                        } else {
                            // `href={website}` with nothing to show: None goes
                            // out as undefined so Svelte drops the attribute
                            // rather than writing the word "None" into it. In a
                            // template the default failure is absence. The same
                            // wrapper the bindings use: the boundary is the
                            // same one, and a prop passed to a child is read
                            // back as None on the other side regardless.
                            out += `{${call(inner, '__bound')}}`;
                        }
                    } else if (trimmed.startsWith('**')) {
                        // `{**attrs}` spreads a Python dict, whose keys become
                        // attributes. Python's own spelling, because Python has
                        // one: everywhere an expression can be written, it is
                        // written the way Python writes it. The output is
                        // JavaScript's `...`, since that is what Svelte reads.
                        //
                        // A shallow copy, so that Svelte's diff against the
                        // previous render sees a mutation: that is what a
                        // JavaScript spread does by itself.
                        out += `{...${call(trimmed.slice(2), '__spread')}}`;
                    } else if (trimmed.startsWith('...')) {
                        throw refuse(
                            new SyntaxError(
                                `svelthon — a spread is written \`{**${trimmed.slice(3).trim()}}\`` +
                                    `${said()}, the way Python spreads a mapping. \`...\` is ` +
                                    `Python's Ellipsis, not a spread, and it keeps that meaning ` +
                                    `everywhere an expression is read.`
                            )
                        );
                    } else if (trimmed.startsWith('@attach ')) {
                        // `{@attach fn}` sits inside the tag rather than around
                        // it, so it is read here. What it holds is Python like
                        // every other expression, and what that yields is a
                        // function Svelte calls with the element, so it goes
                        // through the same wrapper a handler does, which trims
                        // the call to the declared arity, converts the element,
                        // and hands the teardown back.
                        out += `{@attach ${EVENT_WRAPPER}(${call(trimmed.slice(8), '')})}`;
                    } else if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) {
                        // {name}, Svelte's shorthand for name={name}. Expanding
                        // it is what routes the read through the namespace, and
                        // therefore through the accessor.
                        out += `${trimmed}={${call(trimmed, '')}}`;
                    } else if (trimmed.startsWith('@')) {
                        throw refuse(unknownTag(trimmed, 'tag', ATTACHMENTS, said()));
                    } else {
                        out += markup.slice(index, end + 1);
                    }

                    region = null;
                    index = end + 1;
                    continue;
                }
            } else if (char === '>') {
                inTag = false;

                // An element's body is a scope of its own, measured: Svelte
                // emits `const row = …` inside a JavaScript block for a snippet
                // written in a `<div>` as much as in a `<Card>`, so the name
                // dies at the closing tag. Seeding it any wider would replace a
                // Python NameError with a JavaScript ReferenceError, which is
                // the same failure with a worse message.
                if (tag && tag.closing) pop();
                else if (tag && !VOID.has(tag.name.toLowerCase()) && markup[index - 1] !== '/') {
                    push([]);
                }

                tag = null;
            }

            // `bind:value` on its own ends here, at a space, a slash or the
            // closing bracket, so this is where the name is complete and the
            // absence of an `=` is certain.
            if (/[\s/>]/.test(char)) {
                const short = out.match(SHORTHAND);
                if (short) {
                    out += declaredHere(short[1])
                        ? `={${short[1].trim()}}`
                        : `={() => ${call(short[1], '__bound')}, (${BOUND_VALUE}) => ${assign(short[1])}}`;
                }
            }

            out += char;
            index++;
            continue;
        }

        if (char === '<') {
            // An HTML comment is not a tag. Quotes mean nothing inside one, and
            // an apostrophe, as in `aujourd'hui`, would otherwise open a string that
            // never closes, silently leaving the whole rest of the template in
            // JavaScript.
            if (markup.startsWith('<!--', index)) {
                const close = markup.indexOf('-->', index);
                const stop = close === -1 ? markup.length : close + 3;

                out += markup.slice(index, stop);
                index = stop;
                continue;
            }

            const named = markup.slice(index).match(/^<(\/?)\s*([A-Za-z][\w:.-]*)/);
            tag = named ? { closing: named[1] === '/', name: named[2] } : null;

            inTag = true;
            out += char;
            index++;
            continue;
        }

        if (char !== '{') {
            out += char;
            index++;
            continue;
        }

        const end = closingBrace(markup, index);
        if (end === -1) {
            out += char;
            index++;
            continue;
        }

        const inner = markup.slice(index + 1, end);
        const trimmed = inner.trim();

        region = { start: index + 1, end };

        if (trimmed.startsWith('#')) {
            if (trimmed.startsWith('#if ')) {
                push([]);
                out += `{#if ${call(trimmed.slice(4), '__truthy')}}`;
            } else if (trimmed.startsWith('#each ')) {
                out += eachBlock(trimmed, push, call);
            } else if (trimmed.startsWith('#key ')) {
                // Svelte re-creates the block when the value changes, by
                // identity, which no Python value keeps. repr() gives one.
                push([]);
                out += `{#key ${call(trimmed.slice(5), 'repr')}}`;
            } else if (trimmed.startsWith('#await ')) {
                // The awaited expression is Python like any other, a coroutine
                // included, since the wrapper hands one back as a promise. What
                // follows it is a name the block declares, never an expression:
                // `{#await f() then row}`. The split is made at depth zero so
                // that `{#await f("then")}` is not cut inside its own string.
                const rest = trimmed.slice(7);
                const at = atTopLevel(rest, (i) => /^\s(?:then|catch)\s/.test(rest.slice(i)));
                const awaited = at === -1 ? rest : rest.slice(0, at);
                const tail = at === -1 ? '' : rest.slice(at);

                // The name comes from the tail rather than from `BLOCK_NAMES`,
                // which knows `:then` and `:catch` as clauses but has no entry
                // for the shorthand that folds one into the opening tag. Without
                // it `{#await f() then value}` declared nothing, `value` was
                // compiled as a free name, and the block rendered empty, while
                // the same await written the long way worked.
                // Compiled before the scope is pushed: the promise is evaluated
                // outside the block, so the name it declares is not in scope for
                // it: `{#await f(value) then value}` must read the outer one.
                out += `{#await ${call(awaited, '')}${tail}}`;
                push(identifiers(tail.replace(/^\s*(?:then|catch)\s+/, '')));
            } else if (trimmed.startsWith('#snippet ')) {
                // A snippet declares names and holds no expression of its own:
                // it is passed through, and its body is walked like any other.
                //
                // Two scopes are touched, not one. Its parameters go into the
                // block, its own name into what encloses the block, and that name
                // outlives the block, which is the whole point of being able to
                // hand it to a child.
                const declares = trimmed.match(/^#snippet\s+([A-Za-z_]\w*)/);

                if (record && declares) {
                    const holder = ids[ids.length - 1];
                    record.set(holder, [...(record.get(holder) || []), declares[1]]);
                }

                push(declaredBy(trimmed));
                out += markup.slice(index, end + 1);
            } else {
                throw refuse(unknownTag(trimmed, 'block', BLOCKS, said()));
            }
        } else if (trimmed.startsWith('/')) {
            pop();
            out += markup.slice(index, end + 1);
        } else if (trimmed.startsWith(':')) {
            // A continuation clause may rebind the block's names. What the
            // block's scope holds beyond them is kept: a snippet declared in it
            // is still declared after `{:else}`.
            const declared = declaredBy(trimmed);
            if (declared.length) {
                const holder = ids[ids.length - 1];
                scopes[scopes.length - 1] = [...(seed.get(holder) || []), ...declared];
            }

            if (/^:else\s+if\s/.test(trimmed)) {
                out += `{:else if ${call(trimmed.replace(/^:else\s+if\s/, ''), '__truthy')}}`;
            } else if (CLAUSES.some((one) => trimmed === `:${one}` || trimmed.startsWith(`:${one} `))) {
                // `:else`, `:then row`, `:catch err`: a name at most, never an
                // expression, so they cross unchanged.
                out += markup.slice(index, end + 1);
            } else {
                throw refuse(unknownTag(trimmed, 'clause', CLAUSES, said()));
            }
        } else if (trimmed.startsWith('@')) {
            if (trimmed.startsWith('@html ')) {
                out += `{@html ${call(trimmed.slice(6), '__text')}}`;
            } else if (trimmed.startsWith('@render ')) {
                // The snippet itself is a JavaScript function and stays one;
                // what it is *given* is Python. Arguments are split at depth
                // zero, so a comma inside a call or a literal stays put.
                const called = trimmed.slice(8).trim();
                const opens = called.indexOf('(');
                const closes = opens === -1 ? -1 : closingPair(called, opens);

                out += closes === -1
                    ? markup.slice(index, end + 1)
                    : `{@render ${called.slice(0, opens)}(${arguments_(called.slice(opens + 1, closes))
                          .map((one) => (one.trim() ? call(one, '') : one))
                          .join(', ')})${called.slice(closes + 1)}}`;
            } else if (trimmed.startsWith('@debug')) {
                // `{@debug}` takes names rather than an expression, and the
                // names it takes are the JavaScript ones the compiler emits.
                out += markup.slice(index, end + 1);
            } else {
                throw refuse(unknownTag(trimmed, 'tag', TAGS, said()));
            }
        } else {
            const declared = declaration(inner);

            if (declared) {
                // Compiled before the name it declares enters scope: a
                // declaration may read the block's names and the declarations
                // before it, never itself.
                const value = call(declared.expression, '');

                out +=
                    declared.rune === 'state'
                        ? `{let ${declared.name} = $state.raw(${value})}`
                        : `{const ${declared.name} = $derived(${value})}`;

                scopes[scopes.length - 1]?.push(declared.name);
            } else {
                out += `{${call(inner, '__text')}}`;
            }
        }

        region = null;
        index = end + 1;
    }

    return out;
}

// The source ranges of every Python expression a template holds, from the same
// scan the compiler runs, reporting positions instead of producing code.
//
// It exists for the editor: highlighting the Python inside `{…}` means knowing
// exactly where it is, and that is the hard half. Brace balance, quotes,
// interpolation inside an attribute value, and the difference between `{#if x}`
// (where only `x` is Python) and `{x}` are all already solved above, so this
// borrows the answer rather than guessing at it a second time.
// Takes a whole component, not just its template: it goes through overMarkup
// for the same reason the compiler does, so a dict literal in the `<script>` and
// the braces of a `<style>` are never mistaken for template expressions.
export function pythonRanges(content) {
    const ranges = [];
    let n = 0;

    overMarkup(content, (markup, offset) => {
        pythonExpressions(
            markup,
            () => `__range_${n++}`,
            (from, to) => ranges.push({ from: offset + from, to: offset + to })
        );

        return markup;
    });

    return ranges.sort((a, b) => a.from - b.from);
}

// Names a component imports or declares in its `<script module>`. They live in
// JavaScript, and Python cannot import them, but they are in scope for the
// generated code, so publishing them into the namespace makes them readable
// from Python. That is what lets a Python component reach `page` from
// `$app/state`, or any npm library at all.
const MODULE_SCRIPT = /<script[^>]*\b(?:module|context=["']module["'])[^>]*>([\s\S]*?)<\/script>/i;
const IMPORT = /import\s+([\s\S]*?)\s+from\s+['"]/g;

// Whatever the block declares in its own right: a constant, a helper, a class.
const DECLARED = /^([ \t]*)(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;

// Only what the module script declares at its *own* level. `^\s*` with the `m`
// flag matches any indentation, so a `const` inside a function body was
// published as a module name and the component referenced something that does
// not exist there: a ReferenceError at render, for a variable the author had
// scoped correctly.
function topLevelIndent(block) {
    const lines = block.split('\n').filter((line) => line.trim());
    if (!lines.length) return '';

    return lines.reduce((least, line) => {
        const indent = line.match(/^[ \t]*/)[0];
        return indent.length < least.length ? indent : least;
    }, lines[0].match(/^[ \t]*/)[0]);
}

// The head of every dotted directive: the `x` of `in:x.fade`. Svelte copies that
// text into a `() => …`, so `x` has to be a JavaScript binding, and when the
// author meant a Python module, none exists.
//
// Only the five that name a function. `class:` and `style:` name a property, and
// `bind:` names a target; a dot in those means something else entirely.
const DOTTED_DIRECTIVE = /(?:^|[\s"'])(?:use|transition|in|out|animate):([A-Za-z_]\w*)\./g;

export function directiveModules(markup) {
    const found = new Set();

    DOTTED_DIRECTIVE.lastIndex = 0;

    let match;
    while ((match = DOTTED_DIRECTIVE.exec(markup))) found.add(match[1]);

    return [...found];
}

export function moduleImports(content) {
    const block = content.match(MODULE_SCRIPT);
    if (!block) return [];

    const names = [];
    let one;

    IMPORT.lastIndex = 0;

    while ((one = IMPORT.exec(block[1]))) {
        const clause = one[1];
        const braced = clause.match(/\{([\s\S]*)\}/);

        // `import Default, { a as b }`: the part before the brace is a default
        // binding, and each entry inside is renamed by its own `as`.
        for (const piece of (braced ? clause.slice(0, braced.index) : clause).split(',')) {
            const bare = piece.replace(/\*\s*as\s+/, '').trim();
            if (/^[A-Za-z_$][\w$]*$/.test(bare)) names.push(bare);
        }

        if (braced) {
            for (const entry of braced[1].split(',')) {
                const local = entry.split(/\s+as\s+/).pop().trim();
                if (/^[A-Za-z_$][\w$]*$/.test(local)) names.push(local);
            }
        }
    }

    const base = topLevelIndent(block[1]);
    let declaration;

    DECLARED.lastIndex = 0;

    while ((declaration = DECLARED.exec(block[1]))) {
        if (declaration[1] === base) names.push(declaration[2]);
    }

    return [...new Set(names)];
}

// The hidden Python functions a template needs, one per distinct expression.
// Appended to the component's own Python, never prepended, so its line numbers
// stay true, which is what keeps error messages and source maps honest.
export function collector(defs) {
    const seen = new Map();

    return (expression, wrapper, args, assign = false) => {
        const key = `${assign ? 'set' : 'get'}|${wrapper}|${args.join(',')}|${expression}`;
        if (seen.has(key)) return seen.get(key);

        // Both kinds keep the `__expr_` prefix: it is what makes the generated
        // wrapper evaluate them the way a template expression is evaluated.
        const name = `__expr_${assign ? 'set_' : ''}${defs.length}`;
        seen.set(key, name);

        if (assign) {
            // A module name assigned inside a function is local unless declared
            // by Python's rule, and the binding would otherwise write into a
            // frame nobody reads. A block's own name is already a parameter.
            const bare = /^[A-Za-z_]\w*$/.test(expression) && !args.includes(expression);

            defs.push(
                [
                    `def ${name}(${[BOUND_VALUE, ...args].join(', ')}):`,
                    ...(bare ? [`    global ${expression}`] : []),
                    `    ${expression} = ${BOUND_VALUE}`
                ].join('\n')
            );
        } else {
            defs.push(
                `def ${name}(${args.join(', ')}):\n    return ${wrapper ? `${wrapper}(${expression})` : expression}`
            );
        }

        return name;
    };
}

