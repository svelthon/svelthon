// The markup half of the preprocessor: turning a Svelte template's expressions
// into Python. Pure string work, and deliberately free of any Node import: the
// browser playground compiles components client-side and needs exactly this,
// while the file next door needs `fs` and `path` and cannot be loaded there.
import { parse } from 'svelte/compiler';
import { attributeWrapper, truthBinding } from './attributes.js';
import { atomic, replaceLiterals } from './lexical.js';

export { atomic };

// The scanners below look for a closing character and have to know which
// characters are not code, and `atomic` says: the brace, the bracket, the
// top-level walk, the walrus rewrite and the key of an `{#each}`. `tagValue` is
// not one of them; it reads markup, where these rules do not hold.

// Find the '}' closing the block that opens at `start`, ignoring braces inside
// string literals and comments.
//
// **The bound of every walk in this file is unfalsifiable, and it is worth
// saying once here rather than six times.** A mutation sweep turns `i < length`
// into `i <= length` at six of them and none can be told apart: the extra pass
// reads `source[i]` as `undefined`, every comparison against it is false, and
// the walk ends where it would have ended. What *is* separable is what a walk
// hands back, and that is what `tests/quote-state.test.js` and the scanner rows
// of `tests/markup.test.js` read.
function closingBrace(source, start) {
    let depth = 0;

    for (let i = start; i < source.length; i++) {
        // Svelte's own sigils open a block: `{#each`, `{:else`, `{/if`, `{@html`.
        // The `#` of a block is not the `#` of a Python comment, and only the
        // opening brace of *this* block can carry one: a `{` further in belongs
        // to a dict literal, where `#` means what Python says it means.
        if (i === start && '#:/@'.includes(source[start + 1])) {
            depth++;
            i++;
            continue;
        }

        const skip = atomic(source, i);

        if (skip > 0) {
            i += skip - 1;
            continue;
        }

        const c = source[i];

        if (c === '{') depth++;
        else if (c === '}' && --depth === 0) return i;
    }

    return -1;
}

// The bracket closing the one that opens at `start`, whichever it is, ignoring
// brackets inside string literals. `(` for a group or a call, `[` for the
// subscript a walrus may aim at, `{` for the object pattern a snippet
// parameter may destructure.
const CLOSES = { '(': ')', '[': ']', '{': '}' };

function closingPair(source, start) {
    const open = source[start];
    const close = CLOSES[open];
    let depth = 0;

    for (let i = start; i < source.length; i++) {
        const skip = atomic(source, i);

        if (skip > 0) {
            i += skip - 1;
            continue;
        }

        const c = source[i];

        if (c === open) depth++;
        else if (c === close && --depth === 0) return i;
    }

    return -1;
}

// `text` without the groups that hold all of it: `((rows))` is `rows`, and
// `(a), (b)` stays as it is.
function ungrouped(text) {
    let inside = text.trim();

    while (inside.startsWith('(') && closingPair(inside, 0) === inside.length - 1) inside = inside.slice(1, -1).trim();

    return inside;
}

// Walk `text` at depth zero, ignoring anything inside a string, a bracket or a
// parenthesis. Used to find where an expression ends (a comma between two
// arguments, or the `then` of an await block) without parsing Python.
function atTopLevel(text, visit) {
    let depth = 0;

    for (let i = 0; i < text.length; i++) {
        const skip = atomic(text, i);

        if (skip > 0) {
            i += skip - 1;
            continue;
        }

        const c = text[i];

        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
        else if (depth === 0 && visit(i) === true) return i;
    }

    return -1;
}

// The call a `{@render}` makes, `callee(arguments)`: the last group at top
// level, when it closes the expression. The first parenthesis is not it:
// `(first)(1.0)` groups its callee, and `pick(a, b)(1.0)` calls a factory
// first. A group holding the whole call groups it and no more, as Svelte reads
// `{@render (row(1.0))}`, whose arguments are Python's all the same. Null for
// anything else, which Svelte refuses in its own words.
function renderedCall(written) {
    const text = ungrouped(written);
    let depth = 0;
    let last = -1;

    for (let i = 0; i < text.length; i++) {
        const skip = atomic(text, i);

        if (skip > 0) {
            i += skip - 1;
            continue;
        }

        const c = text[i];

        if (c === '(' && depth === 0) last = i;
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
    }

    return last > 0 && closingPair(text, last) === text.length - 1
        ? { head: text.slice(0, last), args: text.slice(last + 1, -1) }
        : null;
}

// `f(a, b)` → ['a', 'b'], with a comma inside a literal or a call left alone,
// and the two that Python writes inside an element at its top level: a
// lambda's parameters, up to its colon, and the target of a generator's `for`,
// up to its `in`. `item(lambda x, y: x + y)` passes one callback, and
// `sum(x for x, y in pairs)` one generator.
function arguments_(text) {
    const parts = [];
    const awaited = [];
    let from = 0;

    atTopLevel(text, (i) => {
        KEYWORD_AT.lastIndex = i;
        const keyword = KEYWORD_AT.exec(text)?.[1];

        if (keyword === 'lambda') awaited.push(':');
        else if (keyword === 'for') awaited.push('in');
        else if (keyword === 'in' && awaited.at(-1) === 'in') awaited.pop();
        else if (text[i] === ':' && text[i + 1] !== '=' && awaited.at(-1) === ':') awaited.pop();
        else if (text[i] === ',' && awaited.length === 0) {
            parts.push(text.slice(from, i));
            from = i + 1;
        }
        return false;
    });

    const last = text.slice(from);
    if (last.trim() || parts.length) parts.push(last);

    return parts;
}

// A word that cannot be called, sitting where a callee would be. Python allows a
// space between a callee and its parenthesis, so `f (x)` is a call and `not (x)`
// is not, and the only thing that tells them apart is whether the word is a
// keyword. Only the ones that can be followed by a parenthesised expression are
// listed; `def` or `class` cannot appear inside a template expression at all.
// What a name is made of, after its first character. Declared here because the
// keyword boundary below is the first reader; `NAME` and `NAME_END` are built
// from it a few lines down, where the reason it is a Unicode class is written
// out.
const NAME_CHAR = '\\p{XID_Continue}';

// The keywords themselves, and the boundary in front of one is the same class as
// the rest of a name, not `\w`, which is ASCII. `énot` is a perfectly good
// Python name ending in four letters that spell a keyword: with an ASCII
// boundary, `é` would end the word before it and `énot(x := 1)` would read as a
// grouping. The class is a constant, and the three readers share it.
const KEYWORD_BEFORE = new RegExp(
    `(^|[^${NAME_CHAR}.])(not|and|or|if|else|in|is|return|yield|lambda|await|assert|` +
        `del|elif|while|for|from|import|raise|with|as|None|True|False)$`,
    'u'
);

// The keywords that hold a comma until their own end, starting at `lastIndex`
// and spelled whole, with the same boundary: `x.lambda` and `info` are none.
const KEYWORD_AT = new RegExp(`(?<![${NAME_CHAR}.])(lambda|for|in)(?![${NAME_CHAR}])`, 'uy');

// A name, spelled the way Python spells one, and the single source every pattern
// in this file that reads a name is built from.
//
// `\w` is ASCII in JavaScript, and `année` or `ligné` is a name to Python. Every
// site that asks "is this a name" reads this one class, and nothing spells it
// out again.
//
// Python's own classes, `XID_Start` and `XID_Continue`, the ones
// `str.isidentifier` answers by: marks are in them because a name in Vietnamese
// or Devanagari carries them, and `℘` or `·` because Python takes them. `u` is
// required for `\p{…}` to mean anything at all.
const NAME = `[\\p{XID_Start}_][${NAME_CHAR}]*`;

// What a callable can end with, just before the parenthesis of a call: the last
// character of a name by the same classes as `NAME`, or the close of a
// subscript, a group or a string.
const NAME_END = new RegExp(`[${NAME_CHAR})\\]"']$`, 'u');

// Whether an expression is a call at its top, which is what Svelte asks of a
// handler before warning that it gave no function (`has_side_effects`):
// `onclick={save()}` gave none by mistake, and a name holding None gives none
// on purpose, as an optional handler. A call at the top is the expression's
// last group, after something a callable ends with, with nothing at the top
// level binding looser: no operator, keyword or comma. A walrus is an
// assignment, which Svelte counts as one too.
const LOOSER = new RegExp(
    `[-+*/%@<>=!|&^~,:]|(?<![${NAME_CHAR}])(?:lambda|if|else|or|and|not|in|is|await|yield|for)(?![${NAME_CHAR}])`,
    'u'
);

function calledAtTop(expression) {
    const text = ungrouped(expression);

    let top = '';
    let last = -1;
    let depth = 0;

    for (let i = 0; i < text.length; i++) {
        const skip = atomic(text, i);

        if (skip > 0) {
            i += skip - 1;
            continue;
        }

        const c = text[i];

        if (c === '(' && depth === 0) last = i;
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
        else if (depth === 0) top += c;
    }

    if (top.includes(':=')) return true;
    if (LOOSER.test(top) || last <= 0 || closingPair(text, last) !== text.length - 1) return false;

    return NAME_END.test(text.slice(0, last).trimEnd());
}

const WALRUS_NAME = new RegExp(`^\\s*(${NAME})`, 'u');
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
            // A name as Python reads it, `box.ﬁeld` being `box.field`.
            key = `"${pythonName(attribute[1])}"`;
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

    while (index < expression.length) {
        const fields = [];
        const skip = atomic(expression, index, (from, to) => fields.push([from, to]));

        if (skip > 0) {
            out += walrusFields(expression, index, index + skip, fields);
            index += skip;
            continue;
        }

        const char = expression[index];

        // Only a *grouping* parenthesis, which is the form Python's grammar
        // forces in a lambda. One that opens a call belongs to the callee:
        // `f(x := 1)` is a call with an argument, and `f((x := 1))` is the form
        // that assigns.
        //
        // The space is why this is two lines rather than one. `f (x := 1)` is a
        // call in Python, whatever space stands before the parenthesis, and
        // `not (x := 1)` is the opposite case: a word before the space, and
        // still a grouping, because `not` cannot be called. So the trailing
        // whitespace is skipped and the word that remains is checked against
        // the keywords. The end of a name is read with the same Unicode classes
        // as `NAME` a few hundred lines up, and not with `\w`, so `café(x := 1)`
        // is a call as `cafe(x := 1)` is.
        const before = out.replace(/\s+$/, '');
        const grouping =
            !NAME_END.test(before) || KEYWORD_BEFORE.test(before);

        if (char === '(' && grouping) {
            // Each element of the group, not only the first. `(a := 1, b := 2)`
            // is the one expression Python has that assigns twice, and it is
            // what a handler needs: JavaScript reaches for its comma operator
            // there, which exists for the same reason: a `for` clause takes one
            // expression and you want two. Read from its start alone, the group
            // would take `1, b := 2` for the value and keep only the first
            // assignment.
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
                    // lives, the attribute under the template's rule for a dot.
                    // The receiver and the key are expressions too, rewritten
                    // as the value is: `(rows[(chosen := 1)] := 7)` sets
                    // `chosen` as well.
                    if (found.name) return `__assign("${pythonName(found.name)}", ${value})`;

                    const key = found.subscript ? walrus(found.key).trim() : found.key;

                    return `${found.subscript ? '__setitem' : '__setattr'}(${walrus(found.object).trim()}, ${key}, ${value})`;
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

// An f-string's fields are code, and a walrus in one writes the component's name
// as it does anywhere else in a handler: `f"{(count := 1)}"`. The text around
// them is kept. A field ending in `=` prints its own text, `(count := 1)=1`, so
// that text becomes a string field of its own, and the value follows with the
// `!r` the `=` implies when the field gives no conversion and no specification.
function walrusFields(source, from, to, fields) {
    let out = '';
    let at = from;

    for (const [start, end] of fields) {
        const field = source.slice(start, end);
        const conversion = field.match(CONVERSION)?.[0] ?? '';
        const text = field.slice(0, field.length - conversion.length);
        const debug = text.match(/(?<![=!<>])=\s*$/);
        const expression = debug ? text.slice(0, debug.index) : field;
        const written = walrus(expression);

        if (written === expression) continue;

        out += debug
            ? `${source.slice(at, start - 1)}{${JSON.stringify(text)}}{${written}${conversion || (source[end] === ':' ? '' : '!r')}`
            : source.slice(at, start) + written;
        at = end;
    }

    return out + source.slice(at, to);
}

// The markup of a component, and nothing else: Python is full of braces (dict
// literals, f-strings) and so is CSS, and rewriting a script's or a style's body
// would be catastrophic.
//
// In one piece, so the scopes it opens hold across every script and style in
// it: a `<style>` inside an `{#each}` cuts nothing, the loop's names reach the
// expressions after it, and a snippet declared below one is known above it.
// What is not markup is made inert text of its own length, so a position in
// what `transform` is handed counts on the file, which `offset` says the start
// of. A script or a style of the component is inert whole; a nested one is an
// element whose body alone is, its tag and its attributes being markup. Each
// goes back in once `transform` has rewritten the rest.
export function overMarkup(content, transform) {
    const inert = [];
    let masked = '';
    let cut = 0;

    for (const block of componentParts(content).blocks) {
        const [from, to] = block.top ? [block.index, block.index + block.text.length] : block.body;
        const text = content.slice(from, to);

        if (text === '') continue;

        inert.push(text);
        masked += content.slice(cut, from) + (text.length === 1 ? INERT_ONE : INERT + blank(text.slice(1, -1)) + INERT);
        cut = to;
    }

    let next = 0;

    return transform(masked + content.slice(cut), 0).replace(INERT_RUN, () => inert[next++]);
}

const INERT = '\u0001';
const INERT_ONE = '\u0002';
const INERT_RUN = /\u0001[^\u0001]*\u0001|\u0002/g;

// The blocks a component has, and its comments, found as Svelte's parser finds
// them: walking the markup with a comment, an expression and a tag stepped over
// whole. A `<style>` quoted in a Python string, `{f"<style>{x}</style>"}`, or
// in an attribute's value is text, and so is a `<script lang="python">` there:
// it declares no Python.
//
// Where a block stands says what it is. At the root, outside every element and
// every `{#…}`, a `<script>` or a `<style>` is the component's own (`top`): its
// attributes are static text, a quoted value read whole so a `>` inside one
// does not end the tag, and its body runs to the tag that closes it, which may
// hold whitespace before its `>`. Anywhere else it is an element like any
// other, whose attributes are markup and whose body alone is raw text, up to
// `</style>` exactly. A `<textarea>`'s content is text and expressions, and no
// tag in it opens anything. An element whose closing tag HTML lets an author
// omit is closed where Svelte closes it (`CLOSED_BY`): a `<p>` by the `<div>`
// after it, a `<li>` by the next `<li>`.
const ROOT_BLOCK = /<(script|style)((?:\s(?:[^>"']|"[^"]*"|'[^']*')*)?)>[\s\S]*?(<\/\1\s*>)/y;
const TEXTAREA_CLOSE = /<\/textarea(\s[^>]*)?>/iy;
const LOGIC = '{';

export function componentParts(content) {
    const blocks = [];
    const comments = [];
    const open = [];

    const element = (at) => {
        TAG_OPEN.lastIndex = at;
        const tag = TAG_OPEN.exec(content);

        if (tag === null) return at + 1;

        const [, closing, name] = tag;

        if (closing) {
            const opened = closedAt(open, name, LOGIC);

            if (opened !== -1) open.length = opened;
            return tagEnd(content, at);
        }

        if (closedBy(open.at(-1), name)) open.pop();

        if (open.length === 0 && (name === 'script' || name === 'style')) {
            ROOT_BLOCK.lastIndex = at;
            const block = ROOT_BLOCK.exec(content);

            if (block !== null) {
                const end = at + block[0].length;
                const body = [at + `<${name}${block[2]}>`.length, end - block[3].length];

                blocks.push({ top: true, index: at, text: block[0], name, attributes: block[2], closing: block[3], body });
                return end;
            }
        }

        const end = tagEnd(content, at);

        if (content[end - 2] === '/') return end;

        if (name === 'script' || name === 'style') {
            const close = content.indexOf(`</${name}>`, end);
            const stop = close === -1 ? content.length : close;
            const after = close === -1 ? stop : close + name.length + 3;

            blocks.push({
                top: false,
                index: at,
                text: content.slice(at, after),
                name,
                attributes: content.slice(at + 1 + name.length, end - 1),
                closing: content.slice(stop, after),
                body: [end, stop]
            });
            return after;
        }

        if (name === 'textarea') {
            for (let i = end; i < content.length; ) {
                TEXTAREA_CLOSE.lastIndex = i;
                if (TEXTAREA_CLOSE.test(content)) return TEXTAREA_CLOSE.lastIndex;
                i = content[i] === '{' ? pastBrace(content, i) : i + 1;
            }

            return content.length;
        }

        if (isComponent({ name }) || !VOID.has(name.toLowerCase())) open.push(name);
        return end;
    };

    for (let i = 0; i < content.length; ) {
        if (content.startsWith('<!--', i)) {
            const end = content.indexOf('-->', i + 4);
            const stop = end === -1 ? content.length : end + 3;

            comments.push({ index: i, text: content.slice(i, stop) });
            i = stop;
        } else if (content[i] === '{') {
            if (content[i + 1] === '#') open.push(LOGIC);
            else if (content[i + 1] === '/' && open.includes(LOGIC)) open.length = open.lastIndexOf(LOGIC);
            i = pastBrace(content, i);
        } else if (content[i] === '<') {
            i = element(i);
        } else {
            i++;
        }
    }

    return { blocks, comments };
}

// The elements an opening tag closes when it stands directly inside them,
// Svelte's `closing_tag_omitted`, from HTML's rules for omitting an end tag.
// Svelte's package does not export it, so this is a copy, which
// `tests/component-blocks.test.js` holds against Svelte's own on every name
// Svelte lists.
const CLOSED_BY = new Map([
    ['li', ['li']],
    ['dt', ['dt', 'dd']],
    ['dd', ['dt', 'dd']],
    [
        'p',
        [
            'address', 'article', 'aside', 'blockquote', 'div', 'dl', 'fieldset', 'footer', 'form',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'main', 'menu', 'nav',
            'ol', 'p', 'pre', 'section', 'table', 'ul'
        ]
    ],
    ['rt', ['rt', 'rp']],
    ['rp', ['rt', 'rp']],
    ['optgroup', ['optgroup']],
    ['option', ['option', 'optgroup']],
    ['thead', ['tbody', 'tfoot']],
    ['tbody', ['tbody', 'tfoot']],
    ['tfoot', ['tbody']],
    ['tr', ['tr', 'tbody']],
    ['td', ['td', 'th', 'tr']],
    ['th', ['td', 'th', 'tr']]
]);

// The two halves of where an element closes, as Svelte's parser closes it, for
// the two readers that keep a stack of what is open (`componentParts`, `walk`).
// An opening `name` closes the element `parent` it stands in when HTML says so.
const closedBy = (parent, name) => CLOSED_BY.get(parent)?.includes(name) ?? false;

// A closing `</name>` closes the element of that name and every one opened
// inside it whose closing tag was left out, never past a block (`block`, the
// stack's mark for one): where the stack is cut, or -1 when nothing closes.
const closedAt = (stack, name, block) => {
    const at = stack.lastIndexOf(name);

    return at !== -1 && !stack.slice(at).includes(block) ? at : -1;
};

// Past the `{…}` that opens at `at`, or past its brace alone when nothing
// closes it: an unclosed brace is the walk's to refuse, by name.
const pastBrace = (content, at) => {
    const close = closingBrace(content, at);

    return close === -1 ? at + 1 : close + 1;
};

// Past the tag that opens at `at`: its quoted values, which may hold a `{…}`,
// and its `{…}`, read whole.
function tagEnd(content, at) {
    for (let i = at + 1; i < content.length; ) {
        const c = content[i];

        if (c === '>') return i + 1;
        if (c === '{') {
            i = pastBrace(content, i);
        } else if (c === '"' || c === "'") {
            let j = i + 1;

            while (j < content.length && content[j] !== c) j = content[j] === '{' ? pastBrace(content, j) : j + 1;
            i = j + 1;
        } else {
            i++;
        }
    }

    return content.length;
}

// `lang="python"` as an attribute of its own, and not as three letters inside
// another name: not `data-lang`, a hyphen being no word character. The value
// may be double-quoted, single-quoted or bare, which is the set Svelte's parser
// accepts and hands to the `script` hook as `attributes.lang`, and all three
// are read here.
//
// Whitespace around the `=` is read too, though a component written that way
// never runs: Svelte's parser refuses `<script lang = "python">` with `Expected
// token >`. Reading wide costs nothing and keeps this from being a second,
// narrower grammar.
//
// Read as attributes, name and value apart, and not as text: a value is not a
// name, so `generics="T extends { module: string }"` declares no module and a
// `lang=python` inside another attribute's value declares no Python.
const ATTRIBUTE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;

export const attributesOf = (text) => {
    const found = new Map();
    for (const [, name, double, single, bare] of text.matchAll(ATTRIBUTE)) {
        found.set(name.toLowerCase(), double ?? single ?? bare ?? true);
    }
    return found;
};

const declaresPython = (text) => attributesOf(text).get('lang') === 'python';

// Where a file's Python script block begins, where its body does, past the
// tag's own `>`, where the body ends, at the tag that really closes it and not
// at a `"</scriptx>"` the Python holds, and how it is closed, or `null` for a
// file that declares none.
//
// Read from the component's own blocks, never from the text of the whole file:
// a JavaScript component holding `const example = '<script lang="python">'`, a
// string, a doc page, a code sample, declares nothing, and neither does a tag
// quoted in a `<style>` body, in an expression or in a comment, nor a script
// nested in an element, which is one.
export function pythonScript(content) {
    const block = componentScript(content, declaresPython);

    if (block === undefined) return null;

    return { index: block.index, body: block.body[0], end: block.body[1], closing: block.closing };
}

// The component's own `<script>` whose attributes `declares` accepts.
const componentScript = (content, declares) =>
    componentParts(content).blocks.find(({ top, name, attributes }) => top && name === 'script' && declares(attributes));

// Where a `<script lang="python">` stands that is not the component's, inside an
// element or a block, or `-1`: Svelte reads it as an element of the page.
export const strayPythonScript = (content) =>
    componentParts(content).blocks.find(({ top, name, attributes }) => !top && name === 'script' && declaresPython(attributes))
        ?.index ?? -1;

// `bind:` needs to read *and* write, which no single expression can do. Svelte
// takes a pair for exactly that, `bind:value={() => v, (n) => v = n}`, so the
// value is compiled twice: once as an expression, once as an assignment target.
// A bare name barely notices, being written the same way in both languages; what
// this buys is `bind:value={row.name}`, a member expression read by Python's
// rules, so the dot finds a dict's key.
//
// Every other directive (`use:`, the transition family, `class:`, `style:`)
// takes an ordinary *value*, and takes a Python one.
const DIRECTIVE = /^bind:/;

// `bind:group` refuses the pair: Svelte works out which inputs form one group
// from the *text* of the expression, and two anonymous functions have none. So it
// does not become a pair, it becomes an action, and the group stops needing an
// identity at all: each input computes its own `checked` from the same target.
//
// And it keeps the write on Python's path: Svelte's own version writes the value
// with a plain JavaScript assignment, which lands on the object but never
// reaches `$B.$setitem`, so nothing would re-render.
const GROUP_DIRECTIVE = /^bind:group\b/;

// The shorthand: `bind:value` with no `={…}` is Svelte's way of writing
// `bind:value={value}`. Left as written, Svelte would bind its own `let` for the
// name, the raw signal cell rather than Python's, since the scanner looks for an
// `=` and finds none. So the shorthand is expanded before anything else looks
// at the tag, and the long form is the only one the rest of this pass has to
// know about. The same
// holds for `class:active` and `style:color`, whose unexpanded read is
// JavaScript's truth of the raw cell: None and `[]` are objects, so both set
// the class.
// The name a shorthand holds, `{name}` or `bind:name`: a name, or Svelte's with
// its `$`. The directive is the whole attribute, after what ends the one before
// it, a space, a quote or a brace (`ATTRIBUTE_CHAR`, written out since it comes
// later): `data-bind:group` is an attribute of that name to Svelte, and was made
// a group action.
const SHORT_NAME = `[\\p{XID_Start}_$][${NAME_CHAR}$]*`;
const SHORTHAND = new RegExp(`(?<=^|[\\s=/>"'}])((bind|class|style):(${SHORT_NAME}))(\\|important)?$`, 'u');
const SHORTHAND_ATTRIBUTE = new RegExp(`^${SHORT_NAME}$`, 'u');

// The action the generated script defines for it. Named here and emitted there,
// like `__event`.
const GROUP_ACTION = '__group';

// The setter's parameter. Generated, so it only has to avoid the author's names.
const BOUND_VALUE = '__value';

// A name the markup declares and a `bind:group` writes, `{picked = []}` then
// `bind:group={picked}`, gets a token declared beside it under this prefix: the
// cell's own identity. Each row of an `{#each}` declares its own cell, and two
// rows may hold equal values, `0` or one shared list, so the value cannot tell
// their groups apart and the token does. Svelte keeps such rows apart too.
const CELL = '__cell_';

// The index an `{#each}` is given when a `bind:group` inside it needs one and
// the author wrote none, this prefix and the block's scope. Svelte keeps a
// group per iteration, by index: two rows holding one object are two groups,
// which the values they hold cannot tell apart.
const EACH_INDEX = '__index_';

// What an `{#each}` walks, declared beside it under this prefix and the block's
// scope (`__collection`, which the compiler writes).
const EACH_ROWS = '__rows_';

// The names a `bind:group` writes as a whole, `bind:group={picked}` or the
// shorthand `bind:group`, read off the markup before the walk: a declaration
// comes before the binding that writes it, and has to know.
const GROUPED = /\bbind:group(?:\s*=\s*["']?\{([^{}]*)\})?/gu;
const groupedNames = (markup) => new Set([...markup.matchAll(GROUPED)].map(([, expr]) => (expr ?? 'group').trim()));

// The module namespace the compiler binds beside the template. Named here and
// emitted there, like `GROUP_ACTION`: the two have to agree.
const NAMESPACE = '__py';

// And the converter it crosses on its way into Python, named here and imported
// there, like `GROUP_ACTION`.
//
// Every runtime name the generated code uses carries a `__`, and this is why: a
// component's own declarations live in the same scope as that import, so a bare
// `pyBind` or `follow` would be a word an author could not use for a name of
// their own: `group`, `init`, `track` and `schedule` are words a Python author
// writes.
const BIND_VALUE = '__pyBind';

// The same crossing for the array a `<select multiple>` writes back.
const SELECTED_VALUE = '__pybridge.selected';

// The subscriber every compiled expression calls on the names it reads.
const FOLLOW = '__follow';

// How a value handed into Python is read, a snippet's parameter here as a
// context's value in `get_context`.
const RECEIVED = '__pybridge.received';

// What a snippet's announcement is held under, numbered per snippet, since a
// snippet inside another reads the outer one's parameters too.
const SNIPPET_FRAME = '__snippet_';

// What a `{@debug}` hands Svelte's under each name, numbered per name.
const DEBUGGED = '__debugged_';

// The whitespace from where it is asked for.
const SPACE_AT = /\s*/y;

// A `{@debug}` that names something, the one this pass rewrites.
const NAMED_DEBUG = /^\{\s*@debug\s+[^\s}]/;

// The plain parameter Svelte hands a snippet's argument by, one per position,
// which the snippet takes apart itself (`snippetParameters`).
const SNIPPET_ARGUMENT = '__argument_';

// A handler takes a *callable*, and Python's is `lambda`. So its value is
// compiled as Python like everything else, and what the expression yields is
// wrapped for JavaScript: `pyHandler` reads the signature Brython recorded,
// trims the call to the arity the author declared and converts the arguments,
// which is what lets `lambda: choose(pep)` ignore the DOM event it is handed
// while `lambda e: read(e.target.value)` receives it.
//
// Which attribute is one is Svelte's rule (`is_event_attribute`): any whose name
// starts with `on`. `onMyEvent` listens to `MyEvent` there, and was handed the
// Python callable raw, its `:=` unwritten and its coroutine never run.
const HANDLER = /^on/;

// The wrapper the generated script defines for handlers. Named here and emitted
// there, so the two have to agree: it exists to carry the component's line
// offset, which the markup pass runs too early to know.
const EVENT_WRAPPER = '__event';

// And for `{@attach}`, whose return value has a consumer a handler's has not:
// Svelte keeps it as the attachment's cleanup.
const ATTACH_WRAPPER = '__attach';

// `class:many={…}` is read for truthiness, so it needs Python's: an empty list
// is false here and true in JavaScript, exactly as in `{#if}`.
const CLASS_DIRECTIVE = /^class:/;

// On an element, and only there: a component's prop of the same name is the
// author's own value, handed on as it is. `<svelte:element>` makes one.
const onElement = (tag) =>
    tag !== null && (tag.name === 'svelte:element' || (/^[a-z]/.test(tag.name) && !tag.name.includes(':')));

// The wrapper an attribute of this name goes through on this tag, or null: the
// one decision every way of writing an attribute asks for.
const wrapperFor = (name, tag) => (onElement(tag) ? attributeWrapper(name) : null);

// Svelte 4 slot syntax, which `{#snippet}` replaced. Neither spelling is an
// expression: `let:item={row}` takes a binding pattern the way `bind:` does, and
// `let:item` on its own declares a name for the slot's body. Neither can be
// compiled as a value, so both are refused with what replaces them.
const LET_DIRECTIVE = /^let:/;

// Whether an attribute name is one the ladder below has a rule for. Svelte 5
// reads `bind:value={x}` and `bind:value="{x}"` as the same thing, and its own
// fixtures write the quoted form, so both spellings reach the same rules: the
// question is asked once, here, before either branch runs.

// What an attribute's name is made of, one answer for every site that asks.
//
// HTML lets an attribute follow a quoted value with no space between them, and
// Svelte's parser follows HTML, so `<b title="y"onclick={go}>` is two
// attributes. The class excludes the quote: a name read as `"y"onclick` would
// match no rule, and a handler would go unwrapped, a binding without its
// write-back, a `class:` without its truthiness and `let:` without its refusal.
//
// The three patterns below are built from the class rather than each carrying
// their own.
const ATTRIBUTE_CHAR = '[^\\s=/>"\']';

// The trailing `\s*` is load-bearing too: Svelte accepts `on:click= {foo}`, and
// its own parser fixture `attribute-with-whitespace` is that line, so
// `title= {x}` is the attribute `title` and not a shorthand to expand.
const ATTRIBUTE_NAME = new RegExp(`(${ATTRIBUTE_CHAR}+)=\\s*$`);

// And the name with no value after it, which is where the shorthand and the
// `let:` refusal read it.
const BARE_ATTRIBUTE = new RegExp(`(${ATTRIBUTE_CHAR}+)$`);

// A name, its `=`, and an unquoted value already begun: what sits before the
// brace of `style:color=red{variable}`. Built from the same class as the three
// above, since it is the same question asked at a fourth place.
const UNQUOTED_VALUE = new RegExp(`(${ATTRIBUTE_CHAR}+)=${ATTRIBUTE_CHAR}+$`);

const directive = (name) =>
    DIRECTIVE.test(name) ||
    HANDLER.test(name) ||
    CLASS_DIRECTIVE.test(name) ||
    LET_DIRECTIVE.test(name);

// `bind:value="{x}"`: a directive whose value is one interpolation and nothing
// else. Svelte concatenates anything else into a string, so `class="a {b}"` is
// text and stays text; only the lone form can drop its quotes and be read as the
// bare spelling.
function loneInterpolation(markup, at, closing) {
    if (markup[at + 1] !== '{') return -1;

    const end = closing(markup, at + 1);

    return end !== -1 && markup[end + 1] === markup[at] ? end + 1 : -1;
}

// The tag's own `value`, for the group action, which is the one place a
// directive has to know something about the attribute beside it.
//
// An element's `value` property is text, so what a group reads off the node is
// the spelling of the author's value rather than the value: `value={1}` comes
// back as "1". The typed one is not on the node either. Svelte keeps it on the
// hidden `__value` property, but only for an element it sees a group binding on
// (`needs_special_value_handling` in its RegularElement visitor), and ours
// carries an action instead. So the value is read from the source here and
// handed to the action.
//
// The braced spelling carries the value; a quoted one is text Svelte
// concatenates, and the node's own value is right for it *at the moment it is
// read*. It changes, though: `value="item-{label}"` has to re-run the action
// when `label` does.
//
// So both spellings are reported, told apart by `braced`, and the caller makes a
// dependency out of the quoted one.
//
// Returns the range rather than the text, so the caller can compile it as the
// expression it is, at the position it sits at.
// The text a literal part of an attribute value stands for, its character
// references decoded. Asked of Svelte's parser rather than of a table written
// here, so the answer is the one the node's attribute gets. The part holds
// neither its own quote, which would have closed the attribute, nor a brace,
// which would have opened an interpolation.
function attributeText(literal, quote) {
    const [element] = parse(`<a b=${quote}${literal}${quote}></a>`, { modern: true }).fragment.nodes;

    return element.attributes[0].value.map((one) => one.data).join('');
}

// A directive that names a function, its head a name or a dotted path, and a
// transition's modifiers after it: `in:fades.typewriter|global`. Only the five
// that name one: `class:` and `style:` name a property, and `bind:` a target.
const DIRECTIVE_HEAD = new RegExp(
    `(use|transition|in|out|animate):(${NAME}(?:\\.${NAME})*)((?:\\|[\\w-]+)*)(?![${NAME_CHAR}.])`,
    'uy'
);

// Where an attribute can begin: after a space, or straight after the quote or
// brace that closed the one before it, as Svelte reads `title="a"use:x`.
const ATTRIBUTE_START = /[\s"'}]/;

// The runtime function each kind is handed to, under the name the component
// imports it by: the three differ in where Svelte puts the payload.
const DIRECTIVE_ADAPTER = {
    use: '__directiveAction',
    transition: '__directiveTransition',
    in: '__directiveTransition',
    out: '__directiveTransition',
    animate: '__directiveAnimate'
};

// A tag's attribute in the unquoted spelling, `type=checkbox` or `value=a`,
// which HTML and Svelte take as the quoted one: the value runs to what ends it
// in Svelte's parser, a space, a quote, `=`, `<`, `>`, a backtick or `/>`, and
// holds no interpolation, which Svelte refuses there
// (`attribute_unquoted_sequence`). Its `quote` is empty. Read only by quote
// and brace, it was no attribute: a checkbox so typed was taken for a radio,
// and a value so written for none, and the server checked no box.
const UNQUOTED_END = /[\s"'=<>`{]/;

function unquotedEnd(markup, at) {
    while (at < markup.length && !UNQUOTED_END.test(markup[at]) && !markup.startsWith('/>', at)) at += 1;

    return at;
}

function tagValue(markup, from, name = 'value') {
    for (let at = from; at < markup.length && markup[at] !== '>'; ) {
        const char = markup[at];

        if (char === '=' && (markup.slice(from, at + 1).match(ATTRIBUTE_NAME) || [])[1] === name) {
            const start = at + 1 + markup.slice(at + 1).match(/^\s*/)[0].length;

            if (!['"', "'", '{'].includes(markup[start])) return { start, end: unquotedEnd(markup, start), braced: false, quote: '' };
        }

        if (char !== '"' && char !== "'" && char !== '{') {
            at += 1;
            continue;
        }

        const end = valueEnd(markup, at);

        if (end === -1) return null;
        if ((markup.slice(from, at).match(ATTRIBUTE_NAME) || [])[1] === name) {
            return { start: at + 1, end, braced: char === '{', quote: char === '{' ? '' : char };
        }

        // The shorthand, `{value}`, which is `value={value}`.
        if (char === '{' && ATTRIBUTE_START.test(markup[at - 1]) && markup.slice(at + 1, end).trim() === name) {
            return { start: at + 1, end, braced: true, quote: '' };
        }

        at = end + 1;
    }

    return null;
}

// Where an attribute value opened at `at`, by a quote or a brace, ends, or -1.
// The quote that closes it, not the first one written: `value="{data["id"]}"`
// holds two inside an interpolation, which is skipped whole, as the main pass
// skips it.
function valueEnd(markup, at) {
    const quote = markup[at];

    if (quote === '{') return closingBrace(markup, at);

    let end = at + 1;

    while (end < markup.length && markup[end] !== quote) {
        if (markup[end] === '{') {
            const closed = closingBrace(markup, end);

            if (closed === -1) return -1;
            end = closed;
        }

        end += 1;
    }

    return end < markup.length ? end : -1;
}

// The names of a tag's attributes, read from its start to its `>`, each value
// skipped whole, so a name written inside one is not counted.
function tagNames(markup, from) {
    let names = '';

    for (let at = from; at < markup.length && markup[at] !== '>'; ) {
        const char = markup[at];

        if (char !== '"' && char !== "'" && char !== '{') {
            names += char;
            at += 1;
            continue;
        }

        const end = valueEnd(markup, at);

        if (end === -1) break;
        names += ' ';
        at = end + 1;
    }

    return new Set(names.match(new RegExp(`${ATTRIBUTE_CHAR}+`, 'g'))?.map((name) => name.toLowerCase()));
}

// Whether a tag holds a spread, `{**attrs}`, which may give it any attribute.
function tagSpreads(markup, from) {
    for (let at = from; at < markup.length && markup[at] !== '>'; ) {
        const char = markup[at];

        if (char !== '"' && char !== "'" && char !== '{') {
            at += 1;
            continue;
        }

        const end = valueEnd(markup, at);

        if (end === -1) return false;
        if (char === '{' && ATTRIBUTE_START.test(markup[at - 1]) && SPREAD(markup.slice(at + 1, end).trim())) return true;

        at = end + 1;
    }

    return false;
}

// The elements HTML closes by itself, which therefore open no body and no
// scope. A component is never one of them.
const VOID = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

// Svelte's own rule for telling a component from an element: a capital first
// letter, a dot in the name, or one of the two `svelte:` forms that stand for a
// component. `svelte:element` renders an element and is not one of them. The
// capital is Unicode's, `\p{Lu}`, as in Svelte's `regex_valid_component_name`:
// `<Étiquette>` and `<Δ>` are components.
//
// It is what `bind:group` has to ask before rewriting itself into an action.
// Every word of the argument for that rewrite is about `<input>`: Svelte works
// out which inputs form one group from the *text* of the expression, so a
// getter/setter pair has nothing to compare. A component has no group machinery
// at all (Svelte reads `bind:group={x}` there as the prop of that name), and it
// refuses `use:` outright.
const COMPONENT = /^(?:\p{Lu}|svelte:(?:component|self)\b)|\./u;

const isComponent = (tag) => tag !== null && COMPONENT.test(tag.name);

const identifiers = (text) => [...text.matchAll(new RegExp(NAME, 'gu'))].map((m) => m[0]);

// The names an expression **reads**, which is not every word in its text.
//
// `identifiers` above answers the other question, which names a *declaration*
// binds, and a pattern holds no strings and no attributes, so one regular
// expression is the whole of it there. An expression is not that: two kinds of
// word in one are not a reference.
//
//   a **string** or a comment   `greet("count")` does not read `count`
//   an **attribute**            `row.label` reads `row`; `label` is the object's
//
// A name an expression does not read may be in the temporal dead zone of the
// declaration it sits in: in `{#each rows as [label="total", total=0]}`,
// reading `total` for the first default would read it before it exists.
//
// **An f-string is code, in its fields and nowhere else.** `f"{count} left"`
// reads `count`, so skipping the literal whole would cost the block the very
// subscription it depends on; reading all of it would count `left`. `atomic`
// says where each field's expression lies, since it is the scanner that tells a
// field from a format specification, where `#` is an option and `'` a fill
// character: `f"{value:#x}"` and `f"{value:'>4}"` read `value` and nothing else.
// A conversion, `!r`, closes the expression as well.
const CONVERSION = /![rsa]\s*$/;

// A name as Python reads it: normalized to NFKC when it holds a character past
// ASCII, as the engine reads every identifier, so `ﬁeld` and `field` are one
// name. The markup compares names so and never rewrites one it emits: a name a
// block declares is a JavaScript variable as well, and JavaScript knows it by
// the spelling it was declared under.
const pythonName = (name) => (/^[\x00-\x7f]*$/.test(name) ? name : name.normalize('NFKC'));

const referenced = (text) => {
    const found = new Set();
    const name = new RegExp(`^${NAME}`, 'u');
    let at = 0;

    while (at < text.length) {
        const fields = [];
        const skip = atomic(text, at, (from, to) => fields.push(text.slice(from, to)));

        if (skip > 0) {
            for (const field of fields) {
                for (const one of referenced(field.replace(CONVERSION, ''))) found.add(one);
            }

            at += skip;
            continue;
        }

        const word = text.slice(at).match(name);

        if (word === null) {
            at += 1;
            continue;
        }

        if (!/\.\s*$/.test(text.slice(0, at))) found.add(word[0]);

        at += word[0].length;
    }

    return [...found];
};

// And the names it reads **from outside itself**, which is what a template
// expression is handed: a lambda's parameters are its own, and so is every
// target of a comprehension, in each of its clauses but the first iterable, as
// CPython scopes them. `(lambda x: x)(7)` reads no `x` of the template's;
// `(lambda y=x: y)()` reads one in its default, and `[x for x in x]` in its
// first iterable. Handed every word, a snippet's parameter the expression
// shadows was read all the same, before the expression ran, and its default
// with it, where Svelte reads none. Read off the tree the engine's parser
// makes, and off the text where it makes none, which the compiler then
// refuses. A walrus's target is taken as read, as it was.
//
// The tree is kept for the text asked last, which `skips` asks of next: one
// parse, where every expression of a page was parsed twice before it compiled.
// Its parentheses let it run over lines, as it does between braces.
let lastTree = { text: null, tree: null };

const expressionTree = (text) => {
    if (lastTree.text !== text) lastTree = { text, tree: targetTree(`(${text}\n)`) };

    return lastTree.tree;
};

const freeNames = (text) => {
    const tree = expressionTree(text);

    if (tree === null) return referenced(text);

    const ast = globalThis.__BRYTHON__.ast;
    const found = new Set();
    const COMPREHENSIONS = [ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp];
    const targets = (node, into) => {
        if (node instanceof ast.Name) into.add(node.id);
        else if (node instanceof ast.Tuple || node instanceof ast.List) for (const one of node.elts) targets(one, into);
        else if (node instanceof ast.Starred) targets(node.value, into);
    };
    const visit = (node, bound) => {
        if (Array.isArray(node)) {
            for (const one of node) visit(one, bound);
            return;
        }
        if (node === null || typeof node !== 'object' || !Array.isArray(node.constructor?._fields)) return;

        if (node instanceof ast.Name) {
            if (!bound.has(node.id)) found.add(node.id);
            return;
        }

        if (node instanceof ast.Lambda) {
            const { args } = node;
            const own = new Set(bound);

            visit([args.defaults, args.kw_defaults], bound);
            for (const one of [...args.posonlyargs, ...args.args, ...args.kwonlyargs, args.vararg, args.kwarg]) {
                if (one) own.add(one.arg);
            }
            visit(node.body, own);
            return;
        }

        if (COMPREHENSIONS.some((kind) => node instanceof kind)) {
            const [first, ...rest] = node.generators;
            const own = new Set(bound);

            visit(first.iter, bound);
            for (const one of node.generators) targets(one.target, own);
            for (const one of node.generators) visit([one.target, one.ifs], own);
            visit(rest.map((one) => one.iter), own);
            visit([node.elt, node.key, node.value], own);
            return;
        }

        for (const field of node.constructor._fields) visit(node[field], bound);
    };

    visit(tree, new Set());
    return [...found];
};

// Whether an expression may run without reading a name it holds: a branch,
// `if … else`, `and`, `or` and a comparison chained past its first test, or a
// body run later or never, a lambda's and a comprehension's. Outside them
// Python reads every name it holds, so a name read ahead is the one it reads,
// and costs no call; inside one, a name read ahead may be one Python would
// not read, a snippet's parameter running its default or a derived its body.
// Text the engine's parser makes no tree of is taken to skip.
const skips = (text) => {
    const tree = expressionTree(text);

    if (tree === null) return true;

    const ast = globalThis.__BRYTHON__.ast;
    const SKIPPING = [ast.IfExp, ast.BoolOp, ast.Lambda, ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp];
    const visit = (node) => {
        if (Array.isArray(node)) return node.some(visit);
        if (node === null || typeof node !== 'object' || !Array.isArray(node.constructor?._fields)) return false;
        if (SKIPPING.some((kind) => node instanceof kind)) return true;
        if (node instanceof ast.Compare && node.comparators.length > 1) return true;

        return node.constructor._fields.some((field) => visit(node[field]));
    };

    return visit(tree);
};

// One entry of a declaration that destructures: a snippet's parameter, and the
// target of an `{#each}`. Either may be a name, a pattern Svelte takes apart,
// or either of those carrying a default.
//
// **A default may sit at any depth.** Svelte's own compiler takes
// `[value = 1]`, `{ a = 1 }` and `{ a: { b = 1 } }` in both positions and
// refuses only a rest parameter, so each default is compiled wherever it sits:
// one left as written would hand Svelte a JavaScript `True`.
//
// And a name is collected only where a name is *bound*, which is what a walk
// that knows a default from a target can say and a regular expression cannot:
// the `True` of a default is no name of the block.
//
// `tuple` is the `{#each}` half of the job, and it is done here rather than
// beside it for the reason the rest of this walk exists. `for k, v in
// d.items()` is how Python unpacks and `as (k, v)` is how it reads, so a
// parenthesised group becomes the brackets Svelte destructures with. The walk
// translates the delimiters it recognises and leaves an expression alone,
// because an expression leaves through `call` before its parentheses are ever
// looked at: `as (a, b=len(x))` keeps `len(x)`.
function parameterPattern(part, call, names, tuple, unpack) {
    const at = atTopLevel(part, (i) => part[i] === '=');

    // `x=expr`, and `[x]=expr` too: what carries the default may be a pattern
    // itself, so the left half goes back through this walk rather than to
    // `identifiers`.
    if (at !== -1) {
        const left = part.slice(0, at);
        const fallback = part.slice(at + 1);

        // **A default after a row unpacked by key or around a star** waits for
        // it. `[{first}, second=first]` unpacks `first` into a `{@const}` after
        // the pattern, while JavaScript takes the default as it takes the
        // pattern apart, before: `Cannot access 'first' before
        // initialization`, where Svelte's own pattern gives `7|7`. So the
        // element stands under an alias, and its default is a `{@const}` in
        // its turn, taken where the alias is `undefined`, as JavaScript takes
        // one; a target that is a pattern is taken apart from what that holds,
        // after it.
        //
        // Every default after such a row, whatever it reads: what it reads is
        // a Python expression, whose names are compared the way Python
        // compares them (`ﬁrst` is `first`) only once compiled, and a default
        // read in its turn answers the same as one read with the pattern.
        if (unpack.bound.size > 0) {
            const alias = unpack.alias();
            const before = names.length;
            const slot = unpack.consts.length;

            unpack.aliases.push(alias);
            unpack.consts.push(null);

            const named = new RegExp(`^\\s*${NAME}\\s*$`, 'u').test(left);
            const target = named ? left.trim() : parameterPattern(left, call, names, tuple, unpack).trim();

            if (named) names.push(target);

            unpack.consts[slot] = { target, missing: alias, fallback };

            for (const one of names.slice(before)) unpack.bound.add(one);

            return `${left.slice(0, left.length - left.trimStart().length)}${alias}`;
        }

        const target = parameterPattern(left, call, names, tuple, unpack);

        return `${target}= ${call(fallback, '', undefined, 'lazy')}`;
    }

    // The spacing the author wrote is theirs, and only the middle is rebuilt.
    const trimmed = part.trim();
    const lead = part.slice(0, part.length - part.trimStart().length);
    const tail = part.slice(part.trimEnd().length);

    // What follows a trailing comma, `[a, b,]`: nothing to bind, and the comma
    // stays, which JavaScript reads the same way.
    if (trimmed === '') return part;

    // A rest where none can stand, or Python's Ellipsis, which is no target:
    // the brackets and the braces that unpack a row take their rest themselves.
    if (trimmed.startsWith('*') || trimmed.startsWith('...')) unpack.refuse(misplaced(trimmed));

    const close = CLOSES[trimmed[0]] === undefined ? -1 : closingPair(trimmed, 0);

    // A pattern: the same question, one level down, for each of its elements.
    //
    // **And only when the group is the whole entry.** A computed key opens with
    // a bracket too, `[field.upper()]: value`, so a group with anything after
    // it is not a pattern: its expression is a key, not a list of targets.
    if (close === trimmed.length - 1 && trimmed[0] === '{') {
        return `${lead}${unpackByKey(trimmed.slice(1, close), call, names, tuple, unpack)}${tail}`;
    }

    if (close === trimmed.length - 1) {
        const parts = arguments_(trimmed.slice(1, close));
        const positional = trimmed[0] === '[' || (tuple && trimmed[0] === '(');

        if (positional && parts.some((one) => one.trim().startsWith('*'))) {
            return `${lead}${unpackStarred(parts, call, names, tuple, unpack)}${tail}`;
        }

        const inside = parts.map((one) => parameterPattern(one, call, names, tuple, unpack)).join(',');

        const [opened, closed] =
            tuple && trimmed[0] === '(' ? ['[', ']'] : [trimmed[0], trimmed[close]];

        return `${lead}${opened}${inside}${closed}${tail}`;
    }

    names.push(...identifiers(trimmed));

    return part;
}

// The name a row unpacked by key stands under, inside the block that unpacks it.
const UNPACKED = '__unpacked_';

// What one declaration list unpacks by key or around a starred name, gathered
// while its patterns are walked: the aliases standing where the braces or the
// brackets stood, in order, and the `{@const}` lines that read them. `refuse`
// throws a pattern's refusal at the block that declares it.
const unpacker = (refuse) => {
    let next = 0;

    return { alias: () => `${UNPACKED}${next++}`, aliases: [], consts: [], bound: new Set(), refuse };
};

// A target is Python's: `**rest` takes the rest of a row by key, `*rest` the
// rest by position, and `...` is the Ellipsis, which nothing is assigned to.
const ELLIPSIS =
    "cannot assign to Ellipsis: `...` is Python's Ellipsis, not a rest. The rest of a row " +
    'is `**rest` by key and `*rest` by position';

// What a rest written where none can stand is told, in Python's words where
// Python has some.
const misplaced = (text) =>
    text.startsWith('...')
        ? ELLIPSIS
        : text.startsWith('**')
          ? `\`${text}\` takes the rest of a row by key, last inside the braces that unpack it: \`{id, ${text}}\``
          : `starred assignment target must be in a list or tuple: \`[first, ${text}]\``;

// `[first, *others, last]`: a row unpacked by position around a starred name,
// which Python's unpacking does and JavaScript's cannot, its rest being last or
// nowhere, and an array. So the brackets become one name, the row, and the
// targets one `{@const}` reading `__unpack(row, before, after)`: the engine's
// own unpacking of a starred target, the starred name a list, and its errors
// for a row too short or not iterable.
function unpackStarred(parts, call, names, tuple, unpack) {
    const alias = unpack.alias();
    const before = names.length;
    const elements = parts.filter((one) => one.trim() !== '');
    const starred = elements.filter((one) => one.trim().startsWith('*'));
    const at = elements.findIndex((one) => one.trim().startsWith('*'));
    const rest = elements[at].trim().slice(1).trim();

    const double = starred.find((one) => one.trim().startsWith('**'));

    if (double !== undefined) {
        const name = double.trim().slice(2).trim();

        unpack.refuse(`\`**${name}\` takes the rest of a row by key; by position the rest is \`*${name}\``);
    }
    if (starred.length > 1) unpack.refuse('multiple starred expressions in assignment');
    if (atTopLevel(rest, (i) => rest[i] === '=') !== -1) unpack.refuse(`a rest takes no default: \`*${rest}\``);

    unpack.aliases.push(alias);

    // The slot is taken before the targets are walked, since a pattern there
    // reads the value this one binds.
    const slot = unpack.consts.length;
    unpack.consts.push(null);

    const targets = elements.map((one, i) => parameterPattern(i === at ? rest : one, call, names, tuple, unpack).trim());

    unpack.consts[slot] = {
        target: `[${targets.join(', ')}]`,
        read: `__unpack(${alias}, ${at}, ${elements.length - at - 1})`,
        source: '',
        lazy: false
    };

    for (const one of names.slice(before)) unpack.bound.add(one);

    return alias;
}

// `{id, name}` in a pattern: a row unpacked by key, which is the dialect's
// shorter spelling of `{row.id}` and `{row.name}`, so each key is read by the
// dot's rule. Svelte destructures a JavaScript object, which finds the keys of
// a dict and nothing else: an instance keeps its attributes under a symbol and
// came out empty, and a misspelt key was `undefined`, which renders as nothing
// where the dot raises the AttributeError.
//
// So the braces become one name, the row, and every key a `{@const}` of the
// block reading `__getattr(row, key)`. A default is read only when the key is
// missing, as Svelte reads it on `undefined`; a key may be computed,
// `{[field.upper()]: value}`; the target may be a pattern itself; and
// `**rest` is the dict of the keys not named, as it is in a `match`, a name and
// last.
function unpackByKey(inside, call, names, tuple, unpack) {
    const alias = unpack.alias();
    const before = names.length;
    const keys = [];
    const entries = arguments_(inside)
        .map((one) => one.trim())
        .filter((one) => one !== '');

    unpack.aliases.push(alias);

    for (const [index, text] of entries.entries()) {
        if (text.startsWith('**')) {
            const target = text.slice(2).trim();

            if (!new RegExp(`^${NAME}$`, 'u').test(target)) {
                unpack.refuse(`\`**\` takes a name, the dict of the keys not named: \`**rest\`, not \`${text}\``);
            }
            if (index !== entries.length - 1) {
                unpack.refuse(`\`${text}\` stands last, as in a mapping pattern: \`{id, ${text}}\``);
            }

            unpack.consts.push({
                target,
                read: `__rest(${alias}, (${keys.map((one) => `${one}, `).join('')}))`,
                source: '',
                lazy: false
            });
            names.push(...identifiers(target));
            continue;
        }

        if (text.startsWith('*')) {
            unpack.refuse(`\`${text}\` takes the rest of a row by position; by key the rest is \`*${text}\``);
        }

        // `id`, `id=0`, `id: target` or `id: target=0`: the default belongs to
        // the target, and a computed key holds an expression of its own.
        const colon = atTopLevel(text, (i) => text[i] === ':');
        const value = colon === -1 ? text : text.slice(colon + 1);
        const equals = atTopLevel(value, (i) => value[i] === '=');
        const target = equals === -1 ? value : value.slice(0, equals);
        const fallback = equals === -1 ? null : value.slice(equals + 1).trim();
        const key = colon === -1 ? target.trim() : text.slice(0, colon).trim();
        const computed = key.startsWith('[') && closingPair(key, 0) === key.length - 1;

        // A computed key is evaluated once, into a name of its own beside the
        // row's, and that value is both the key the field is read by and the
        // one `**rest` leaves out: evaluated twice, a key that answers
        // otherwise the second time read one field and left out another.
        const held = computed ? unpack.alias() : null;

        if (computed) {
            unpack.aliases.push(held);
            unpack.bound.add(held);
            unpack.consts.push({ target: held, read: `(${key.slice(1, -1)})`, source: key.slice(1, -1), lazy: false });
        }

        // A key written bare is a name, which Python reads normalized: `ﬁeld` is
        // `field`, as in `row.ﬁeld`. A quoted one is a string, kept as written.
        const named = computed ? held : /^['"]/.test(key) ? key : JSON.stringify(pythonName(key));

        keys.push(named);

        // The slot is taken before the target is walked, since a pattern there
        // reads the value this one binds.
        const slot = unpack.consts.length;

        unpack.consts.push(null);
        unpack.consts[slot] = {
            target: parameterPattern(target, call, names, tuple, unpack).trim(),
            read: `__getattr(${alias}, ${named}${fallback === null ? '' : `, lambda: (${fallback})`})`,
            source: fallback ?? (computed ? key.slice(1, -1) : ''),
            lazy: fallback !== null
        };
    }

    for (const one of names.slice(before)) unpack.bound.add(one);

    return alias;
}

// The `{@const}` lines a declaration list unpacks into, compiled once every
// name of the block is in scope. A default goes through `lazy`, so a later key
// it reads is read only when the default is taken; one an element waited for
// is taken where its alias is `undefined` (`parameterPattern`).
const unpacked = (unpack, call) =>
    unpack.consts
        .map(({ target, read, source, lazy, missing, fallback }) =>
            missing === undefined
                ? `{@const ${target} = ${call(read, '', source, lazy ? 'lazy' : 'python')}}`
                : `{@const ${target} = ${missing} === undefined ? ${call(fallback, '', undefined, 'lazy')} : ${missing}}`
        )
        .join('');

// The names a declaration binds, read without compiling anything.
//
// **Two passes, because a default reads the names beside it.** In Svelte,
// `(j, k = j)` gives `k` the `j` of the same list, `[a, b = a]` the same in an
// `{#each}`, and a default that reaches a name declared *after* it throws
// `Cannot access 'h' before initialization`, JavaScript's own rule, which our
// output inherits since a compiled default reads the binding Svelte emitted. So
// every name goes into the scope first and the expressions are compiled second:
// in one pass, `{#each rows as [first, second=first]}` would read a module's
// `first` instead of the row's.
const boundBy = (parts, tuple, unpack) => {
    const names = [];

    for (const part of parts) parameterPattern(part, () => '', names, tuple, unpack);

    return names;
};

// The names of a declaration list whose read runs code (`computing`): those of
// every part that is not a bare name, a pattern, which a `{@const}` reads a key
// or an attribute for, or a parameter holding a default.
const unpacking = (parts, tuple, refuse) =>
    boundBy(
        parts.filter((part) => !DECLARED_NAME.test(part.trim())),
        tuple,
        unpacker(refuse)
    );

// A comma list of patterns that a block declares: its names go to `declare`,
// which opens the block's scope, with the aliases of the rows it unpacks by key
// beside them and the names whose read runs code (`unpacking`), and the list
// comes back with every expression in it compiled inside that scope. Every
// construct that binds names in the markup goes through here: a snippet's
// parameters, an `{#each}` target, and the value an `{#await}` hands to `then`
// or `catch`. `consts` is what the block opens with. `refuse` throws a refusal
// at the block.
const destructured = (text, declare, call, tuple, refuse) => {
    const parts = arguments_(text.trim());
    const first = unpacker(refuse);

    declare(boundBy(parts, tuple, first), first.aliases, unpacking(parts, tuple, refuse));

    const unpack = unpacker(refuse);
    const pattern = parts.map((part) => parameterPattern(part, call, [], tuple, unpack)).join(',');

    return { pattern, unpack, consts: unpacked(unpack, call) };
};

// `{#snippet row(one, value=True)}` read apart: the names go to `declare`,
// which opens the block's scope, and what comes back is the declaration
// rewritten with each default compiled as the Python expression it is. The
// split is at top level, so a comma or an `=` inside a string or a call belongs
// to the default and not to the list.
//
// **The snippet takes its arguments apart itself, once it has said it is
// Python's.** Svelte is handed one plain parameter per position
// (`SNIPPET_ARGUMENT`); the snippet's first act is its announcement (`frame`),
// and only then is each position read into what the author wrote, a name, a
// pattern or a default, by one `{@const}` each (`__pybridge.param`). Left to
// Svelte, a pattern and a default were read before the announcement, which is
// how a Python child rendering a Python parent's snippet knows to hand it
// Python values: in development Svelte reads them at once to check them, and a
// server hands values rather than reads, so they had crossed already. A server
// keeps what it was handed before crossing, which the announcement takes back.
function snippetParameters(trimmed, declare, call, refuse, frame) {
    const open = trimmed.indexOf('(');
    const head = open === -1 ? trimmed : trimmed.slice(0, open);
    const close = open === -1 ? -1 : closingPair(trimmed, open);

    // Named as Python names it, `ﬁeld` being `field`, the spelling every
    // `{@render}` of it is given too.
    const name = pythonName(head.replace(/^#snippet\s*/, '').trim());

    // No parameter list, or one Svelte will refuse in its own words: nothing is
    // declared.
    if (close === -1) {
        declare([], []);

        return `${trimmed.replace(/^#snippet\s*/, '')}}`;
    }

    const parts = arguments_(trimmed.slice(open + 1, close));
    const first = unpacker(refuse);

    declare(boundBy(parts, false, first), first.aliases, unpacking(parts, false, refuse));

    const unpack = unpacker(refuse);
    const given = [];
    const reads = [];

    // **Each position read and unpacked before the next**, as JavaScript reads
    // a parameter list: a default reads the names the parameters before it
    // bound, `({first}, second=first)` the `first` of the row before it, which
    // a row unpacked after every read had not bound yet.
    parts.forEach((part, at) => {
        // What follows a trailing comma, `(a, b,)`: no parameter.
        if (part.trim() === '') return;

        const argument = `${SNIPPET_ARGUMENT}${at}`;
        const equals = atTopLevel(part, (i) => part[i] === '=');
        const from = unpack.consts.length;
        const target = parameterPattern(equals === -1 ? part : part.slice(0, equals), call, [], false, unpack).trim();
        const fallback = equals === -1 ? '' : `, () => ${call(part.slice(equals + 1), '', undefined, 'lazy')}`;

        given.push(argument);
        reads.push(
            `{@const ${target} = __pybridge.param(${argument}, ${frame}, ${at}${fallback})}` +
                unpacked({ consts: unpack.consts.slice(from) }, call)
        );
    });

    return (
        `${name}(${given.join(', ')})${trimmed.slice(close + 1)}}` +
        `{let ${frame} = __pybridge.pythonSnippet(${name})}${reads.join('')}`
    );
}

// The key that trails an `{#each}` target: `[target, key]`, or null when the line
// carries none.
//
// A key is an expression, so it holds parentheses of its own: a call, a builtin,
// a tuple, which is how Python writes a composite key.
//
// So the group is found by balance rather than by content, ignoring parentheses
// inside a string, as `atomic` reads one: a triple-quoted string holding a lone
// quote, and an f-string whose field reuses its quote, `f"{"("}{row.id}"`. Forward,
// not backwards: only a forward scan can tell an escaped quote from a real one.
function trailingKey(text) {
    let depth = 0;
    let opens = -1;

    for (let i = 0; i < text.length; i++) {
        const skip = atomic(text, i);

        if (skip > 0) {
            i += skip - 1;
            continue;
        }

        const c = text[i];

        if (c === '(') {
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

// `loop` is what the walk asks of the block: `rows()`, the name of what it
// walks, `index(keyed)`, the name to give the iteration's index when the author
// wrote none and a key or a `bind:group` needs one, and for `bind:group`
// `noted(index, from)`, told the index the block has and the names its
// iterable reads.
//
// **The block walks what a name declared beside it hands over**, `{const
// __rows_… = __collection(…)}`, and not its iterable: the iterable is Python,
// and reads each name it mentions with everything under it, so a change inside
// one row ran the block again over every row. The walk tells the block only
// when the rows are no longer the same (`__pybridge.walk`), and the block runs
// again on a change of the list itself, as Svelte's does.
function eachBlock(trimmed, declare, call, refuse, loop) {
    const head = trimmed.match(/^#each\s+([\s\S]+)$/);

    if (!head) return `{${trimmed}}`;

    // **The separator at the top level, not the first one written**, so
    // `{#each ["a as b"] as item}` does not split inside the string.
    //
    // `atTopLevel` is the mechanism the `await` block already uses for its own
    // `then` and `catch`, three hundred lines down: it skips what `atomic`
    // calls a token, so a separator inside a string or a call is not one.
    const body = head[1];
    const at = atTopLevel(body, (i) => /^\s+as\s+/.test(body.slice(i)));

    // No `as`: nothing is declared, and there is no key to find either.
    // Compiled before the scope opens, like the iterable below.
    if (at === -1) {
        const iterable = call(body, '__seq', undefined, 'python');

        declare([]);
        return `${walked(loop.rows(), iterable, null)}{#each ${loop.rows()}()}`;
    }

    const named = body.slice(at).replace(/^\s+as\s+/, '');
    const keyed = trailingKey(named);

    // **A target destructures, and a destructuring holds expressions**, as a
    // snippet's parameter list does, and one walk answers for both: in
    // `{#each rows as [value=True]}` the default is Python and `True` is no name
    // of the block.
    //
    // Split at the top level first, because the target is a comma list of its
    // own (`as (a, b), i` is a pattern and then Svelte's index), and each
    // entry is a pattern in its own right.
    //
    // **Three scopes, in three steps, and the order is the whole rule.** The
    // iterable is evaluated where the loop is written, so it is compiled before
    // the block's names exist: `{#each rows as rows}` reads the outer list. The
    // target's own names then open the scope, every one of them, the index
    // included, which is what `[a, b = a]` and `[f = i], i` need and what
    // `[g = h, h]` needs in order to throw where JavaScript throws. Only then
    // are the defaults compiled, and the key last, since it is evaluated inside
    // the block on each row.
    // Kept Python: Svelte only walks it, and every row goes back to Python
    // expressions. Converted, it would be a fresh list each render, its floats
    // numbers, and a row would have no identity left to key by.
    const iterable = call(body.slice(0, at), '__seq', undefined, 'python');
    const target = keyed ? keyed[0] : named;
    const { pattern, unpack, consts } = destructured(target, declare, call, true, refuse);

    // Svelte's index is the second of two, `as row, at`; one the author did
    // not write is added when a group needs it, or a key, under the walk's
    // name.
    const parts = arguments_(target.trim());
    const written = parts.length === 2 ? parts[1].trim() : null;
    const index = written ?? loop.index(keyed !== null);

    loop.noted(index, freeNames(body.slice(0, at)));

    const declared = written === null && index !== null ? `${pattern}, ${index}` : pattern;
    const key = keyed ? eachKey(keyed[1], unpack, call) : null;

    // The key twice: as Svelte reads it, in the block, noted at its row's
    // place, and as the walk reads it again for a row that changed
    // (`__pybridge.walk`), in a function taking what Svelte's takes, the row
    // and its index.
    return (
        walked(loop.rows(), iterable, key === null ? null : `(${declared}) => ${key}`) +
        `{#each ${loop.rows()}() as ${declared}` +
        (key === null ? '' : ` (${loop.rows()}.noted(${index}, ${key}))`) +
        `}${consts}`
    );
}

const walked = (rows, iterable, key) =>
    `{const ${rows} = __collection(() => ${iterable}${key === null ? '' : `, ${key}`})}`;

// The key of an `{#each}` is computed outside the block, from the pattern's own
// names, and a key unpacked by key is a `{@const}` of the block. So such a name
// is bound again in the key's own expression, by a comprehension over the row,
// and is not handed in from a scope the key does not see.
//
// **The rows are handed in unfollowed.** Svelte computes every key at each run
// of the block, inside it, so what a key reads, the block reads: a row followed
// there made a change anywhere in any row run the block again over all of them,
// where Svelte's key reads the one field it names. A name the key reads is
// still the block's, as in Svelte, and a key a change in its row moves is told
// by what the block walks.
function eachKey(key, unpack, call) {
    if (unpack.consts.length === 0) return call(key, '__key', key, '', [], false);

    const loops = unpack.consts.map(({ target, read }) => ` for ${target} in [${read}]`).join('');

    return call(`[(${key})${loops}][0]`, '__key', key, '', [...unpack.bound], false);
}

// What Svelte's template language holds, named here so that anything else stops
// rather than crosses: a construct nobody listed would otherwise carry its
// expression as JavaScript inside a component that promises Python.
const BLOCKS = ['if', 'each', 'key', 'await', 'snippet'];
const CLAUSES = ['else', 'then', 'catch'];
// `{@…}` is read in two positions and the two sets do not overlap: Svelte places
// `{@attach}` inside a tag and the other three outside one. One shared list made
// every refusal name the very word the author had just written: `{@html x}` in
// a tag was refused by a sentence listing `html` among the tags it knows.
const TAGS = ['html', 'render', 'debug'];
const ATTACHMENTS = ['attach'];

// **A keyword and what follows it are parted by whitespace, not by a space.**
//
// In Svelte's own compiler, over every block, clause and tag it has, a tab and a
// newline part them exactly as a space does, and only an *absent* separator is
// refused. A condition wrapped over two lines is ordinary markup, and
// `prettier-plugin-svelte` writes one for a long `{#if}`. Asked once here, for
// every gate.
//
// The keyword is a whole word, so `{@debugger}` is not `{@debug}` with a
// suffix, and the text after it is handed on unread: every branch below trims
// its own expression, and a leading tab is whitespace to Python too.
const SEPARATED = /^([A-Za-z]+)(\s[\s\S]*)?$/;

const keyword = (trimmed, sigil) => {
    if (!trimmed.startsWith(sigil)) return null;

    const found = trimmed.slice(sigil.length).match(SEPARATED);

    return found === null ? null : { name: found[1], rest: found[2] ?? '' };
};

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
// And the powerful form costs nothing when nobody uses the power: in Svelte
// 5.56.9, a `$state.raw` that nothing writes to compiles to a bare binding,
// exactly as a `const` would. Svelte upgrades it to a signal only when a `bind:`
// writes to it.
//
// `$state.raw` and never `$state`: the latter deep-proxies, and a Brython object
// behind a JavaScript proxy fails its own type checks.
const DECLARED_NAME = new RegExp(`^${NAME}$`, 'u');

// An expression as Python reads it, by the parser of the Brython the compiler
// has loaded before any markup is read. A binding's target: `(amount)` is the
// `Name` `amount`, and `bag["selected"]`, `bag[ "selected" ]` and
// `bag['selected']` are one `Subscript`. And where an `{#await}` ends. Null for
// text that does not parse, which the compiler refuses where it is written once
// it compiles it.
function targetTree(expr) {
    const $B = globalThis.__BRYTHON__;

    if (typeof $B?.Parser !== 'function') {
        throw new Error("svelthon: reading a template expression needs Brython's parser, which `compile.cjs` loads");
    }

    try {
        return $B._PyPegen.run_parser(new $B.Parser(expr.trim(), '<target>', 'eval')).body;
    } catch {
        return null;
    }
}

// The name a target is, when it is one.
const bareName = (expr) => {
    const node = targetTree(expr);

    return node instanceof globalThis.__BRYTHON__.ast.Name ? node.id : null;
};

const NUMBERS = new Set(['bool', 'int', 'float', 'complex']);

// A number as Python compares it as a key: `1`, `1.0` and `True` are one entry
// of a dict, and so is `1+0j`.
const numberKey = (value) => {
    const $B = globalThis.__BRYTHON__;
    const _b_ = $B.builtins;
    let real = value;

    if ($B.class_name(value) === 'complex') {
        if (_b_.bool.$factory($B.$getattr(value, 'imag'))) return _b_.repr(value);
        real = $B.$getattr(value, 'real');
    }

    // A float holding a whole number is that int's key; `nan` and `inf` hold none.
    if ($B.class_name(real) === 'float' && !$B.$call($B.$getattr(real, 'is_integer'))) return _b_.repr(real);

    return _b_.repr(_b_.int.$factory(real));
};

// What makes two targets one whatever their spelling: the tree, positions left
// out, a constant by its class and its `repr`, and a number that is a key by its
// value, as Python compares keys. A key is what a subscript holds, each member
// of a tuple held there and the operand of a sign in front of it: `bag[1]`,
// `bag[True]` and `bag[(1.0, -1)]` are entries a dict compares, while the `1`
// of `bag[str(1)]` is an argument, and `str(1)` is not `str(True)`. A sign in
// front of a number at a key is the number it makes: `bag[+1]` is `bag[1]`, and
// `bag[-0.0]` is `bag[0]`.
const targetKey = (expr) => {
    const $B = globalThis.__BRYTHON__;
    const signed = (node) => node.op instanceof $B.ast.USub || node.op instanceof $B.ast.UAdd;
    const number = (node) => {
        if (node instanceof $B.ast.Constant) return NUMBERS.has($B.class_name(node.value)) ? node.value : null;
        if (!(node instanceof $B.ast.UnaryOp) || !signed(node)) return null;

        const operand = number(node.operand);

        return operand === null
            ? null
            : $B.$call($B.$getattr(operand, node.op instanceof $B.ast.USub ? '__neg__' : '__pos__'));
    };
    const atKey = (node, field, held) =>
        node instanceof $B.ast.Subscript
            ? field === 'slice'
            : held &&
              ((node instanceof $B.ast.Tuple && field === 'elts') ||
                  (node instanceof $B.ast.UnaryOp && field === 'operand' && signed(node)));
    const key = (node, held = false) => {
        if (Array.isArray(node)) return `[${node.map((one) => key(one, held)).join(',')}]`;
        if (node === null || typeof node !== 'object') return JSON.stringify(node ?? null);

        const value = held ? number(node) : null;

        if (value !== null) return `Number(${numberKey(value)})`;
        if (node instanceof $B.ast.Constant) return `Constant(${$B.class_name(node.value)}:${$B.builtins.repr(node.value)})`;

        const fields = node.constructor._fields.map((field) => key(node[field], atKey(node, field, held)));

        return `${node.constructor.$name}(${fields.join(',')})`;
    };
    const node = targetTree(expr);

    return node === null ? expr.trim() : key(node);
};

// The compiler's own prefix, written the same way `compile.cjs` writes it: a
// name that begins with `__` and does not end with one, so Python's own dunders,
// `__all__` and `__doc__`, stay free.
//
// The script half has refused a module-level name of this shape since the
// beginning; the markup half declares names too and refused nothing. A
// declaration spelled like one of the functions this pass appends emitted
// `{let X = $state.raw(X())}`, where the name the author declared shadows the
// very function that produces its value, and a block alias of that spelling put
// the same collision one scope down. Svelte accepts both, so nothing was said.
//
// The spellings are not written out here: `tests/generated-names.test.js` reads
// every `__name` this file holds, prose included, and asks the compiler to
// define it.
const COMPILER_PREFIX = /^__(?!.*__$)/;

// What `walrus()` emits for the plain form, read back so that a write aimed at a
// markup name can be refused rather than sent to the wrong scope.
const ASSIGNED = new RegExp(`__assign\\("(${NAME})"`, 'gu');

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

// JavaScript's declaration keywords, which Svelte 5 takes inside a block:
// `{const a = n}` is its own spelling of `{@const}`. Svelthon's answer is the
// template rune, `{a = n}`, so the keyword is a JavaScript word in a place that
// reads Python, and it is refused with the spelling that replaces it.
const DECLARATION_KEYWORD = new RegExp(`^(const|let|var)\\s+(${NAME})\\s*=\\s*(.+)$`, 'su');

const declarationKeyword = (trimmed, at) =>
    new SyntaxError(
        `svelthon — \`{${trimmed}}\` declares with a JavaScript keyword${at}; ` +
            `Svelthon writes it \`{${trimmed.replace(DECLARATION_KEYWORD, '$2 = $3')}}\`, ` +
            `and \`{name => expression}\` for one that follows what it reads. A ` +
            `construct left unhandled would cross as JavaScript, so it is refused ` +
            `rather than passed through.`
    );

// Where a spread is written, and the three places it is not.
//
// A spread fills a tag's attributes, so it is an attribute of its own: `<div
// {**attrs}>`. Out in the body there is nothing for it to spread into, and
// attached to a name there is one attribute where it wants many. Svelte refuses
// that second spelling itself, `Unexpected token`, and the quoted third would
// reach Brython as `__text(**attrs)` and come back as a syntax error about a
// comma, on a line the author never wrote.
//
// `**` cannot open a Python expression at all, so it is refused on sight. `...`
// can: it is Ellipsis, and `{...}`, `{... if x else y}` and `{...[0]}` are all
// expressions an author is entitled to write. Only `...` run straight into a
// name is a spread.
const SPREAD = (trimmed) => trimmed.startsWith('**') || /^\.\.\.[A-Za-z_$]/.test(trimmed);

const spreadOutOfPlace = (trimmed, at, named) => {
    const spread = trimmed.replace(/^(\*\*|\.\.\.)/, '').trim();

    return new SyntaxError(
        `svelthon — a spread fills a tag's attributes, so \`{**${spread}}\` is ` +
            `an attribute of its own${at}, as in \`<div {**${spread}}>\`. ` +
            (named
                ? `Written as the value of \`${named}\` there is one attribute where ` +
                  `it wants many.`
                : `Out here there is nothing for it to spread into.`) +
            (trimmed.startsWith('...')
                ? ` And \`...\` is Python's Ellipsis, not a spread, which is what ` +
                  `it keeps meaning everywhere an expression is read.`
                : '')
    );
};

const unknownTag = (trimmed, kind, known, at) =>
    new SyntaxError(
        `svelthon — \`{${trimmed}}\` is not a ${kind} Svelthon knows${at}; ` +
            `the ${kind}s are ${known.join(', ')}. A construct left unhandled would ` +
            `cross as JavaScript, so it is refused rather than passed through.`
    );

// Where a refusal happened, in the file the author is looking at, as every
// refusal of the compiler names one: `walk()` keeps `region` on every `{…}` it
// reads, and that is the place.
//
// `filename` and `start` go on the error object too, in Svelte's own shape, so
// vite-plugin-svelte and an editor can put the squiggle under the character
// rather than print a sentence.
//
// `starts` is where each line of the file starts (`lineStarts`), read once for
// the whole walk: a line counted on a copy of everything before each
// expression made the pass quadratic in its expressions.
function lineColumn(starts, offset) {
    let low = 0;
    let high = starts.length - 1;

    while (low < high) {
        const middle = (low + high + 1) >> 1;

        if (starts[middle] <= offset) low = middle;
        else high = middle - 1;
    }

    return { line: low + 1, column: offset - starts[low], character: offset };
}

const lineStarts = (content) => {
    const starts = [0];

    for (let at = content.indexOf('\n'); at !== -1; at = content.indexOf('\n', at + 1)) starts.push(at + 1);

    return starts;
};

// A snippet's name belongs to the scope that *encloses* the block, and to the
// whole of it: Svelte hoists the declaration, so `<Card {row} />` may be written
// above the `{#snippet row(x)}` it names. One left-to-right walk cannot know a
// name it has not reached yet, so the markup is walked twice: once with a
// throwaway collector, to record which scope each snippet name belongs to, then
// for real with every scope seeded.
//
// The parameters are the other half: `x` belongs *inside* the block, the name
// belongs outside it.
// `where` is `{ filename, content, offset }`, and it is what a refusal needs to
// name a position: `offset` is where `markup` starts in the file, and `content`
// is the whole of it. Optional, since the playground and the range scan below
// compile a fragment that belongs to no file.
export function pythonExpressions(markup, collect, onPython, where) {
    const named = new Map();

    const indexed = new Set();

    walk(markup, () => '__probe', undefined, new Map(), named, where, indexed);

    return walk(markup, collect, onPython, named, null, where, indexed);
}

// A tag's opening, read where the walk stands rather than on a copy of the rest
// of the markup. A name starts as an identifier does, `\p{ID_Start}`, which is
// what Svelte's component names allow: an ASCII letter left `<Étiquette>` no tag.
const TAG_OPEN = /<(\/?)\s*(\p{ID_Start}[\p{ID_Continue}$‌‍:.-]*)/uy;

// Two names as Python compares them (`pythonName`): `ﬁeld` declared and
// `field` read are one name. Every question of which name an expression reads
// is asked through this, and no spelling is compared as it was written.
const sameName = (one, other) => pythonName(one) === pythonName(other);

// The scopes the markup declares names in, from the component's own to the
// block being read, and what a name an expression reads is in them. `seed` is
// what the first walk recorded in each scope, `indexed` where it asked for an
// index, and `refuseCompilerName` the refusal every declared name goes through.
function scopeChain(seed, indexed, refuseCompilerName) {
    // Scopes are numbered by the order they are opened in, which two walks of
    // the same markup agree on. The base scope, the component's own, is 0.
    let opened = 0;
    const ids = [0];
    const scopes = [[...(seed.get(0) || [])]];

    // Each scope's names by the name Python reads, the first declared spelling
    // of each, made when a lookup first needs them and again after the scope
    // changes: a lookup then normalizes the one name it is asked about.
    const keyed = [undefined];
    const keysOf = (scope) => {
        const keys = new Map();

        for (const one of scope) if (!keys.has(pythonName(one))) keys.set(pythonName(one), one);

        return keys;
    };

    // What opened each scope, an element's name or `null` for a block, so an
    // element closes where Svelte closes it: at the tag that closes it, which
    // closes too the elements whose closing tag was left out inside it, and at
    // a tag HTML closes it for (`CLOSED_BY`), a `<p>` at the `<div>` after it.
    const owners = [null];

    // The `{#each}` blocks by scope: the index each iteration has, or `null`
    // while the first walk has not asked for one, and the names its iterable
    // reads.
    const loops = new Map();

    // `generated` are the pass's own names, the aliases of `unpackByKey`, which
    // the prefix rule does not apply to.
    const push = (names, generated = []) => {
        opened += 1;
        ids.push(opened);
        owners.push(null);
        scopes.push([...(seed.get(opened) || []), ...refuseCompilerName(names), ...generated]);
        keyed.push(undefined);
    };

    // Never below the base scope: unbalanced markup is Svelte's to refuse, and
    // popping past the bottom here would lose the snippet names it holds.
    const pop = () => {
        if (scopes.length > 1) {
            scopes.pop();
            ids.pop();
            owners.pop();
            keyed.pop();
        }
    };

    const closeElement = (name) => {
        const at = closedAt(owners, name, null);

        if (at > 0) while (owners.length > at) pop();
    };

    // A clause of the open block: a new branch, numbered like a block so the
    // snippets the first walk recorded in it come back, and holding nothing of
    // the branch before it. Never the base scope, for the reason above.
    //
    // Two steps, because `{:else if}` reads its condition between them: where
    // the branch stands, after the previous branch has closed and before its
    // own snippets exist.
    const branch = () => {
        if (scopes.length > 1) {
            opened += 1;
            ids[ids.length - 1] = opened;
            scopes[scopes.length - 1] = [];
            keyed[keyed.length - 1] = undefined;
        }
    };

    const seeded = () => {
        if (scopes.length > 1) {
            scopes[scopes.length - 1].push(...(seed.get(ids[ids.length - 1]) || []));
            keyed[keyed.length - 1] = undefined;
        }
    };

    // Names declared in the innermost scope: a branch's clause, a template
    // rune, the cell a group binds. `generated` as for `push`.
    const declare = (names, generated = []) => {
        scopes[scopes.length - 1]?.push(...refuseCompilerName(names), ...generated);
        keyed[keyed.length - 1] = undefined;
    };

    // The innermost scope's names that are a snippet's parameters.
    const parameters = (names) => {
        scopes[scopes.length - 1].parameters = new Set(names);
    };

    // The innermost scope's names whose read may run code, the author's or a
    // default's: a name a pattern unpacks, which reads a key or an attribute,
    // one whose parameter holds a default, and a derived the markup declares.
    // And every snippet parameter, bare or not: Svelte hands one as a function
    // of the `{@render}` argument, which reading it runs. A row, an index or a
    // state cell is read as it is held.
    const computing = (names = []) => {
        const scope = scopes[scopes.length - 1];

        if (scope) for (const one of names) (scope.computed ??= new Set()).add(one);
    };

    const costly = (name) => {
        const held = found(name);

        return (
            held !== null &&
            (scopes[held.at].computed?.has(held.declared) === true || scopes[held.at].parameters?.has(held.declared) === true)
        );
    };

    // The innermost scope holding `name`, and the spelling it was declared
    // under, what JavaScript knows the variable by. Null when no scope holds it.
    const found = (name) => {
        const key = pythonName(name);

        for (let at = scopes.length - 1; at >= 0; at--) {
            const declared = (keyed[at] ??= keysOf(scopes[at])).get(key);

            if (declared !== undefined) return { at, declared };
        }

        return null;
    };

    // The names in scope, one per name as Python compares names, the innermost
    // hiding the outer ones: an inner `ﬁeld` hides an outer `field`, and is read
    // under the spelling it was declared with, what JavaScript knows it by.
    const inScope = () => {
        const visible = new Map();

        for (let at = scopes.length - 1; at >= 0; at--) {
            for (const one of scopes[at]) {
                if (!visible.has(pythonName(one))) visible.set(pythonName(one), one);
            }
        }

        return [...visible.values()];
    };

    // A snippet's parameter is handed over by whoever renders the snippet, a
    // JavaScript component or this markup, converted or not: it is read as
    // every value coming into Python is (`__pybridge.received`), so a callable
    // Python handed out is itself again. The innermost scope holding the name
    // says whether it is one.
    const received = (name) => {
        const held = found(name);

        return held !== null && scopes[held.at].parameters?.has(held.declared) ? `${RECEIVED}(${name})` : name;
    };

    // The block names an expression actually reads, rather than every name in
    // scope: passed a tag-declared state the expression never mentions, Svelte
    // warns `state_referenced_locally`, since it sees the state read outside a
    // reactive position.
    //
    // It is the right shape anyway. `follow(x)` subscribes the reader to `x`,
    // and an expression that does not read `x` has no business depending on it.
    const mentioned = (expr) => {
        const names = new Set(freeNames(expr).map(pythonName));

        return inScope().filter((one) => names.has(pythonName(one)));
    };

    // The name in scope that `name` reads, in the spelling it was declared
    // under. Null when no scope holds it.
    const scoped = (name) => found(name)?.declared ?? null;

    // The iterations a group binding stands in, as Svelte finds them: every
    // `{#each}` whose names the binding reads, and then those its iterable
    // reads, from the innermost out. Their indexes keep apart two rows holding
    // one object, which the values the binding mentions cannot. A block whose
    // author wrote no index is noted for the second walk to give it one.
    const iterations = (expr) => {
        const names = new Set(freeNames(expr).map(pythonName));
        const indexes = [];

        for (let at = scopes.length - 1; at > 0; at--) {
            const loop = loops.get(ids[at]);

            if (loop === undefined || !scopes[at].some((one) => names.has(pythonName(one)))) continue;

            if (loop.index === null) indexed.add(ids[at]);
            else indexes.push(loop.index);

            for (const one of scopes[at]) names.delete(pythonName(one));
            for (const one of loop.from) names.add(pythonName(one));
        }

        return indexes;
    };

    return {
        push,
        pop,
        closeElement,
        branch,
        seeded,
        declare,
        parameters,
        computing,
        costly,
        inScope,
        received,
        mentioned,
        scoped,
        iterations,

        // Whether a scope holds `name`.
        holds: (name) => found(name) !== null,

        // The id of the innermost scope, which the first walk recorded under.
        id: () => ids.at(-1),

        // The element that opened the innermost scope.
        own: (name) => {
            owners[owners.length - 1] = name;
        },

        // Whether a tag of this name closes the element of the innermost scope.
        closes: (name) => closedBy(owners.at(-1), name),

        // The id of the scope the element a closing tag of this name closes
        // opened, undefined when no open element has the name.
        openedBy: (name) => ids[closedAt(owners, name, null)],

        // An `{#each}` noted under its scope (`iterations`).
        loop: (id, noted) => loops.set(id, noted)
    };
}

// `indexed` holds the `{#each}` blocks, by scope, that a group binding needs the
// iteration index of and whose author wrote none: the first walk finds them,
// the second gives them one.
function walk(markup, collect, onPython, seed, record, where, indexed) {
    let out = '';
    let index = 0;

    const headAt = (at) => {
        DIRECTIVE_HEAD.lastIndex = at;
        return DIRECTIVE_HEAD.test(markup);
    };
    let inTag = false;
    let quote = null;
    let quotedAttribute = null;
    // Whether the quoted value being read is one interpolation and nothing
    // else, `data="{value}"`.
    let quotedLone = false;
    let region = null;

    // The index of the closing quote of a directive whose quotes are being
    // dropped, so the pair is skipped rather than written out around a value the
    // bare branch is about to rewrite.
    let unquoted = -1;

    const grouped = groupedNames(markup);

    // Every snippet this markup declares, wherever: the first walk recorded
    // them, scope by scope.
    const snippets = new Set([...seed.values()].flat());
    let snippetCount = 0;
    let debugCount = 0;
    // The blocks of a run of `{@debug}` tags, held for the last one of it.
    let debugHeld = '';

    // The tag being read, so that its closing `>` knows what it closed, and
    // what is written after that `>`.
    let tag = null;
    let ended = false;
    let ending = '';

    // The current tag as written, up to where the walk stands. An attribute name
    // never reaches back past its own tag and is copied through unchanged, so
    // the patterns that read "the attribute just before this character" are
    // matched here: on the input, which is one flat string, and on this tag
    // alone, which keeps the walk linear in the size of the template.
    //
    // Inside a directive whose quotes are dropped, the opening quote is in the
    // input and not in what is written, and it is the character just behind.
    let tagIn = 0;
    const tagText = () => markup.slice(tagIn, unquoted === -1 ? index : index - 1);

    // Every name the markup declares goes through here or through the two
    // writes below, which is why the refusal sits on the way in rather than at
    // each of the four constructs that can declare one.
    const refuseCompilerName = (names) => {
        const taken = [names].flat().find((one) => COMPILER_PREFIX.test(one));

        if (taken === undefined) return names;

        throw refuse(
            new SyntaxError(
                `svelthon — \`${taken}\` starts with \`__\`, which is the compiler's own ` +
                    `prefix${said()}. The markup pass names the function behind every ` +
                    `expression with it, and declares that function in the scope your name ` +
                    `is declared in, so a name of that shape takes one of theirs: the ` +
                    `declaration would read its own value from itself. Python's own names ` +
                    `end with \`__\` as well, and those are free.`
            )
        );
    };

    const chain = scopeChain(seed, indexed, refuseCompilerName);
    const { push, pop, closeElement, branch, seeded, declare, parameters, computing, costly, received, mentioned, scoped, iterations, holds } = chain;

    // The `{` of the construct being read, as the author sees it. `region.start`
    // is the character after the brace, so this steps back onto it.
    const starts = where ? lineStarts(where.content) : null;
    const position = () =>
        where && region ? lineColumn(starts, where.offset + region.start - 1) : null;

    // The lines an expression written over several takes back from its
    // rewrite, a call that holds on one: Svelte places its warnings
    // on the text it compiles, and neither vite-plugin-svelte nor svelte-check
    // maps them back, so everything below was reported as many lines too high
    // (`sameLines` keeps the script's). Given back inside the rewrite's last
    // brace, where they are blank space of the expression, and all at the end
    // (`edited`): written in place, each would copy the whole output.
    const edits = [];
    const keepLines = (emitted, from, to) => {
        const source = markup.slice(from, to + 1);

        if (!source.includes('\n') || !out.endsWith('}')) return;

        const lost = source.split('\n').length - out.slice(emitted).split('\n').length;

        if (lost > 0) edits.push({ at: out.length - 1, lines: lost });
    };

    // The name of the attribute being read, and its `=`, taken back out of what
    // has been written, its `length` read off the input, which it was copied
    // from: the pass writes a name before it knows what follows it, and
    // `bind:group` becomes an action. Taken out at the end too: cut in place,
    // each cut copied the whole output, and a page of a thousand checkboxes
    // copied it a thousand times.
    const cut = (length) => {
        edits.push({ at: out.length - length, to: out.length });
    };

    // The output with what is owed given back and what is cut taken out, each
    // noted where the walk stood, so in the order they stand in it.
    const edited = () => {
        let given = '';
        let at = 0;

        for (const edit of edits) {
            given += out.slice(at, edit.at);

            if (edit.lines === undefined) {
                at = edit.to;
            } else {
                given += '\n'.repeat(edit.lines);
                at = edit.at;
            }
        }

        return given + out.slice(at);
    };

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
            error.end = where && region ? lineColumn(starts, where.offset + region.end + 1) : at;
        }

        return error;
    };

    // A pattern a block declares and nothing can bind, told at the block.
    const refusePattern = (message) => {
        throw refuse(new SyntaxError(`svelthon — ${message}${said()}`));
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
    //
    // `kind` says where the value goes, when that is not JavaScript:
    //
    //   'python'  back into Python, which reads it again: a declaration of the
    //             markup, `{x = 0.5}`, and an argument of `{@render}`. The value
    //             stays the Python one, where one bound for the DOM is made a
    //             JavaScript number, and a float would come back a `JSObject`.
    //   'lazy'    the same, for an expression whose names may not exist yet
    //             when it is prepared: a default inside a pattern, where a later
    //             name of the same pattern is still in the temporal dead zone.
    //   'scalar'  a value a binding compares by identity, a `value` or a
    //             `bind:` read: a scalar is made JavaScript's, so `0.5` twice
    //             is one value, and a container is handed over as the object it
    //             is, so an option finds its select and a group its list.
    //   'selection' the read of a `<select multiple>`'s binding: the same, item
    //             by item, for the list whose items meet the options' values.
    //   'choice'  the `value` of a control a `bind:group` binds, which only the
    //             group reads, as Python does: the same, save a value only
    //             itself is equal to, which the group gets back as it is.
    // `bound` names the block's names the expression binds for itself, which
    // are therefore not handed in: the key of an `{#each}`, see `eachKey`.
    // `followed` is false for that key alone, which `eachKey` says why.
    //
    // An expression that may run without reading a name it holds (`skips`) and
    // holds one whose read runs code (`costly`), and every one of the 'lazy'
    // kind, is handed each name as a function that reads it, and the compiler
    // makes the reads calls (`templateDots`), so a branch Python does not take
    // reads nothing, as in Python and as in Svelte's own `true ? 7 : x`: read
    // before the call, `{7 if True else x}` read a snippet's parameter, and its
    // default with it, and failed on what the branch excluded. Any other is
    // handed each name read: a row read ahead is the row a branch would read,
    // and a call for each read cost a row's update a fifth more.
    const call = (expr, wrapper, source = expr, kind = '', bound = [], followed = true) => {
        const trimmed = expr.trim();
        const args = mentioned(trimmed).filter((one) => !bound.some((name) => sameName(name, one)));
        const late = args.length > 0 && (kind === 'lazy' || (args.some(costly) && skips(trimmed)));

        locate(source.trim());
        // The column of its opening brace, counted from zero: where every
        // refusal of this pass points.
        const at = position();
        const name = collect(trimmed, wrapper, args, false, at?.line, kind, at?.column, late);

        // follow() on the block's own names: a row of an {#each} is a plain
        // JavaScript value, not a signal, so reading `it.label` registers
        // nothing by itself. This is what subscribes the row's block to the row.
        const value = (arg) => (followed ? `${FOLLOW}(${received(arg)})` : received(arg));
        const handed = (arg) => (late ? `() => ${value(arg)}` : value(arg));

        return `${name}(${args.map(handed).join(', ')})`;
    };

    // The write half of a binding: the same text, compiled as an assignment
    // target rather than as an expression. No locate(): it is the same source
    // text the read half already reported, and a range must not be sent twice.
    //
    // The value crosses through `pyBind`, which is where a JavaScript number
    // becomes a Python one. It is the only conversion a binding makes, and every
    // binding makes it here rather than each at its own site.
    const assign = (expr, crossing = BIND_VALUE) => {
        const args = mentioned(expr.trim());
        const at = position();
        const name = collect(expr.trim(), '', args, true, at?.line, '', at?.column);
        const rest = args.map((arg) => `${FOLLOW}(${received(arg)})`);

        return `${name}(${[`${crossing}(${BOUND_VALUE})`, ...rest].join(', ')})`;
    };

    // The group action, in one place for the two spellings of `bind:group`.
    //
    // It takes the read, the write, and the value the tag was given: the DOM
    // keeps only the text of that value, so a number bound from `value={1}`
    // comes back as "1" and matches nothing. See `tagValue` for why the node
    // cannot answer this.
    // A quoted value, compiled the way Svelte compiles it:
    //
    // - **One interpolation and nothing else** is not text. `value="{n}"` binds
    //   the number `1`, exactly as `value={n}` does.
    // - **Text around an interpolation** is a concatenation, and it *changes*:
    //   read off the node, it would be read whenever the action happens to run,
    //   which is not ordered against Svelte writing the attribute.
    //
    // So the parts are compiled here and joined here, under the rules the
    // attribute itself is built by, since the two have to give one string:
    //
    // - each interpolation through `__text`, as the main pass compiles an
    //   attribute's: `None` is empty and `False` is `False`, where `String()`
    //   would give `None` and `false`;
    // - each literal decoded as Svelte decodes it, asked of Svelte's own parser:
    //   `a&amp;{n}` is `a&1` on the node and in the model alike.
    //
    // A lone interpolation keeps its typed value. A value with no interpolation
    // is left to the node: it is static text and nothing can move it.
    const quotedValue = (text, quote, kind = '') => {
        const pieces = [];
        let at = 0;
        let literal = 0;

        while (at < text.length) {
            if (text[at] !== '{') {
                at += 1;
                continue;
            }

            const end = closingBrace(text, at);

            if (end === -1) break;

            if (at > literal) pieces.push({ literal: text.slice(literal, at) });

            pieces.push({ expression: text.slice(at + 1, end) });
            at = end + 1;
            literal = at;
        }

        if (literal < text.length) pieces.push({ literal: text.slice(literal) });

        if (!pieces.some((one) => one.expression !== undefined)) return 'undefined';
        if (pieces.length === 1) return call(pieces[0].expression, '', undefined, kind);

        return pieces
            .map((one) =>
                one.expression !== undefined
                    ? call(one.expression, '__text')
                    : JSON.stringify(attributeText(one.literal, quote))
            )
            .join(' + ');
    };

    // A binding's read/write pair, one rule for its two spellings,
    // `bind:value={x}` and `bind:value`. Svelte compares what the read gives: a
    // scalar is made JavaScript's and a container kept as the object it is
    // (`scalar`), and the value of a `<select multiple>`, a list each of whose
    // items meets an option's `value`, is made so item by item (`selection`).
    // `multiple` is read off the whole tag, Svelte requiring it static there.
    //
    // What comes back is crossed the same way: the selection Svelte writes is
    // an array, a list in Python (`__pybridge.selected`).
    //
    // A name the markup declared is read the same way, its cell holding the
    // Python value, and written by the setter itself, see `declaredHere`.
    //
    // A `<select>` whose `multiple` a spread may give is read and written as
    // Svelte reads it, by what the element is. The read asks `select.multiple`
    // of the select an action registers, written before it (`spreadSelect`),
    // under its place in the markup; the read is a function of its own per
    // element, which claims its element the first time it runs, so two selects
    // sharing a binding, the rows of an `{#each}` and the renders of a snippet
    // each keep theirs. The write, which Svelte hands no element, is told by the
    // options of the selects at that place (`selectWrite`).
    const spreadSelect = (directive, expr) => {
        if (directive !== 'bind:value' || tag?.name !== 'select' || tagNames(markup, tag.start).has('multiple')) return null;
        if (!tagSpreads(markup, tag.start)) return null;

        tag.select ??= selects++;

        const key = `${NAMESPACE}, ${tag.select}`;

        return { action: `use:__pybridge.selectShape={[${key}]}`, key, read: `__select_${tag.select}` };
    };

    const boundPair = (directive, expr) => {
        const shaped = spreadSelect(directive, expr);

        if (shaped !== null) {
            const crossing = `__pybridge.selectWrite(${shaped.key})`;
            const write = declaredHere(expr) ? declaredWrite(expr, crossing) : assign(expr, crossing);
            const value = call(expr, '__bound', undefined, 'python');

            return (
                `function ${shaped.read}() { return __pybridge.selectRead(${value}, ${shaped.key}, ${shaped.read}); }, ` +
                `(${BOUND_VALUE}) => ${write}`
            );
        }

        const multiple = directive === 'bind:value' && tag?.name === 'select' && tagNames(markup, tag.start).has('multiple');
        const crossing = multiple ? SELECTED_VALUE : BIND_VALUE;
        const write = declaredHere(expr) ? declaredWrite(expr, crossing) : assign(expr, crossing);
        if (heldChild() !== null) {
            return `() => ${forChild(call(expr, '__bound', undefined, 'child'), 'scalar')}, (${BOUND_VALUE}) => ${write}`;
        }

        // A binding Svelte reads for truth, on an element: the Python value,
        // its truth taken as an attribute of that name takes it, on this side
        // of the expression, where an absence is still `undefined`. A
        // component's prop of that name is the author's value, read below.
        if (onElement(tag) && truthBinding(directive.slice('bind:'.length))) {
            return `() => __pybridge.boundTruth(${call(expr, '', undefined, 'python')}), (${BOUND_VALUE}) => ${write}`;
        }

        const read = multiple ? 'selection' : toPythonChild() ? 'child' : 'scalar';

        return `() => ${call(expr, '__bound', undefined, read)}, (${BOUND_VALUE}) => ${write}`;
    };

    // Whether the tag being read is a child written in Python, which is handed
    // the Python value itself, a `Price(float)` with its class and a `15.0`
    // still a float, by every way a prop is written: by name, short, spread,
    // bound, and under a name beginning with `on`, which may be a callback or
    // data. None is handed as `undefined`, the absence a Svelte prop reads its
    // default for, as at every door. A JavaScript child is handed
    // JavaScript's own. `<svelte:self>` is the component being compiled,
    // which is written in Python.
    const toPythonChild = () =>
        isComponent(tag) &&
        tag.held === undefined &&
        (tag.name === 'svelte:self' || where?.pythonChildren?.has(tag.name) === true);

    // What a tag holds its child by, when its file does not tell its language:
    // a name the markup binds, a snippet's parameter, an `{#each}` item, one
    // the script assigned, `Selected = Child if wide else Native`, an import
    // from a package, a module that re-exports it or a namespace, or the
    // `this` of `<svelte:component>`. Null for a tag its file names. Its
    // language is known only once it is handed: each prop is made Python and
    // converted for that child, `__pybridge.child`. The child is read once, as
    // Svelte reads a tag, into a name of its own (`heldTag`), unless it is an
    // import's own name, which reads again with nothing run (`wrap`).
    const heldSource = (one) => {
        if (!isComponent(one)) return null;

        // `this={X}`, or `this="{X}"`, a lone interpolation between quotes,
        // which Svelte reads as the same expression. The attribute is skipped
        // whole where the walk meets it (`thisFrom`, `thisTo`).
        if (one.name === 'svelte:component') {
            const value = tagValue(markup, one.start, 'this');
            if (value === null) return null;

            let start = value.start;
            let end = value.end;

            if (!value.braced) {
                const open = markup.indexOf('{', start);
                const lone = open !== -1 && !markup.slice(start, open).trim() && closingBrace(markup, open);

                if (!lone || lone === -1 || lone > end || markup.slice(lone + 1, end).trim()) return null;
                start = open + 1;
                end = lone;
            }

            one.thisFrom = value.start - 1;
            one.thisTo = value.end;
            region = { start, end };
            const read = call(markup.slice(start, end), '__bound');
            region = null;
            return { read, wrap: true };
        }

        if (one.name.includes(':')) return null;

        const [head, ...rest] = one.name.split('.');
        const local = scoped(head);

        // A child reached through an attribute, `<Holder.Child />`, is read as
        // Python reads it, as `this={Holder.Child}` is, and followed: written
        // as JavaScript, it read an instance's attribute, a slot, a property
        // or a class's name as the property of that name, undefined, and the
        // child was not there, and a child put in its place was not read
        // again.
        if (rest.length > 0) return { read: call(one.name, '__bound'), wrap: true };

        if (local !== null) return { read: local, wrap: true };
        if (where?.imported === undefined) return null;

        // A child named by its own file is known; an import read again is
        // the same binding, with nothing run, so it needs no block.
        if (rest.length === 0 && (where.pythonChildren.has(head) || where.javascriptChildren.has(head))) return null;
        return { read: one.name, wrap: rest.length > 0 || !where.imported.has(head) };
    };
    const taken = new Set(identifiers(markup));
    let heldCount = 0;
    const heldTag = () => {
        let name;
        do name = `SvelthonChild${heldCount++}`;
        while (taken.has(name));
        return name;
    };
    // The open elements that bound their child, by scope.
    const heldOwners = new Map();

    // The selects a spread may make multiple, numbered in markup order.
    let selects = 0;

    const heldChild = () => tag?.held ?? null;
    const forChild = (read, kind = '') => `__pybridge.child(${heldChild()}, ${read}, ${JSON.stringify(kind)})`;

    const groupAction = (expr) => {
        // The Python list itself: the group compares with Python's `==`, and
        // its inputs know each other by the list they share.
        const read = call(expr, '', undefined, 'python');

        // A name the markup declared is Svelte's cell, which Svelte writes
        // itself: `assign` would hand it to a `def` as a parameter and write
        // that. The value still crosses into Python on the way.
        const own = declaredHere(expr);
        const write = own ? declaredWrite(expr, BIND_VALUE) : assign(expr);
        const found = tag === null ? null : tagValue(markup, tag.start);
        const outer = region;

        // No locate(): the attribute reports its own range where it is written,
        // and `bind:group={n} value={n}` would otherwise report the binding's
        // range a second time, the two texts being the same.
        region = null;

        // The value stays the Python one, which the group compares as Python
        // does: the attribute makes it a JavaScript scalar for the DOM, and a
        // NaN, or an instance of a subclass of float, int or str, is then
        // another value.
        const value =
            found === null
                ? 'undefined'
                : found.braced
                  ? call(markup.slice(found.start, found.end), '', undefined, 'python')
                  : quotedValue(markup.slice(found.start, found.end), found.quote, 'python');

        region = outer;

        // And the binding itself, as Python reads it rather than as it is
        // spelled (`targetKey`): `bag["selected"]` and `bag[ 'selected' ]` are
        // one target. The action needs to know which inputs belong together.
        // Two bindings may hold one list
        // (`left = shared`, `right = shared`), and sharing a value is not sharing
        // a binding, so the list they hold is not what identifies a group.
        //
        // And the instance, as its namespace. Two *instances* of one component
        // have the same binding text and may have been handed the same list
        // (`selected = initial`, with one empty list passed to both), so neither
        // of the two halves above tells them apart. The namespace is the thing
        // every element of one instance shares and no other instance has.
        //
        // And the template names the binding mentions, which are what tell the
        // rows of an `{#each}` apart: `row.picked` is one target per `row`.
        // The list the row holds cannot stand in for them, since two rows may
        // be handed one default list and are still two targets. A cell the
        // markup declared is its own target, told by its token.
        const cell = own ? `${CELL}${scoped(bareName(expr))}` : null;
        const where = cell !== null && holds(cell) ? [cell] : [...mentioned(expr.trim()), ...iterations(expr)];

        // And `checked` for the server, which runs no action: Svelte's server
        // writes it for its own group, from the model, when the tag has a value,
        // a checkbox being one whose `type` is the static text `checkbox`. With
        // no node to read static text off, the server is handed the text. A tag
        // that writes `checked` itself, by the attribute or by `bind:checked`,
        // is checked by it, as Svelte's is, and gets no second one, which
        // Svelte refused beside the binding as `attribute_duplicate`.
        const kind = tag === null ? null : tagValue(markup, tag.start, 'type');
        const boxes = kind !== null && !kind.braced && markup.slice(kind.start, kind.end) === 'checkbox';
        const served =
            found !== null && value === 'undefined'
                ? JSON.stringify(attributeText(markup.slice(found.start, found.end), found.quote))
                : value;
        const names = tag === null ? null : tagNames(markup, tag.start);
        const checked =
            names !== null && (names.has('checked') || names.has('bind:checked'))
                ? ''
                : ` checked={__pybridge.groupChecked(() => ${read}, () => ${served}, ${boxes})}`;

        // And whether the value is braced, the shorthand or a lone
        // interpolation between quotes, all three compiled typed for the
        // field: the browser then reads the one the field evaluated, where
        // Svelte wrote it (`group`).
        const fielded = found !== null && (found.braced || loneInterpolation(markup, found.start - 1, closingBrace) !== -1);

        return (
            `use:${GROUP_ACTION}={[${read}, (${BOUND_VALUE}) => ${write}, ${value}, ${fielded}, ` +
            `${JSON.stringify(targetKey(expr))}, ${NAMESPACE}, [${where.join(', ')}]]}${checked}`
        );
    };

    // `bind:group` on a component, where `group` is an ordinary prop and none of
    // the group machinery applies. Svelte still refuses the read/write pair
    // there: its check is on the *name* of the binding, wherever it is written,
    // and answers `bind:group can only bind to an Identifier or MemberExpression`.
    //
    // So the pair any other binding has, crossing as it does, is handed over
    // as a member of a name, which it accepts, see `__pybridge.pair`.
    //
    // Anything but a name is refused rather than guessed.
    const componentGroup = (target) => {
        if (bareName(target) !== null) {
            return `__pybridge.crossing[__pybridge.pair(${boundPair('bind:group', target)})]`;
        }

        throw refuse(
            new SyntaxError(
                `svelthon — \`bind:group={${target}}\` on a component${said()} can only ` +
                    `bind a plain name. On a component \`group\` is an ordinary prop, and ` +
                    `Svelte refuses the read/write pair for a binding of that name wherever ` +
                    `it is written, so the expression has to be one Svelte can read itself. ` +
                    `Bind a name, or give the prop another one.`
            )
        );
    };

    // A `bind:` whose target is a name the *markup* declared, a `{x = e}` or a
    // block's own alias, cannot be written by `assign`. The generated `def`
    // receives that name as a parameter, so `x = value` would assign to the
    // parameter and the write would die with the call. Silently.
    //
    // Svelte already knows how to write those, so the setter writes the name
    // itself. In Svelte 5.56.9, a tag-declared `$state.raw` that nothing writes
    // to compiles to a bare binding, and Svelte upgrades it to a real signal the
    // moment an assignment targets it.
    //
    // The read still goes through Python: the cell holds a Python value, which
    // the DOM reads only once made its own, a float a number and `None` empty.
    const declaredHere = (expr) => {
        const name = bareName(expr);

        return name !== null && scoped(name) !== null;
    };

    // A binding's write to a name the markup declared, Svelte's cell: the value
    // crossed into Python, and followed as the declaration's is
    // (`__pybridge.state`), or a list a child put there and then let go of
    // repainted nothing when it changed.
    const declaredWrite = (expr, crossing) =>
        `${scoped(bareName(expr))} = __pybridge.state(${crossing}(${BOUND_VALUE}))`;

    // `(x := …)` writes through the namespace, which holds the module's names
    // and nothing else. A name the markup declared is not there, so the write
    // would land on a module name of the same spelling, creating one if it had
    // to. Silently, and in the wrong scope.
    //
    // Refused rather than supported: `bind:` writes those names already, and a
    // handler that wants to toggle something has the script for it. What is
    // missing is the ability to *write* a markup name from a handler, and none
    // of the 889 components of the corpus asks for it.
    const refuseMarkupWalrus = (rewritten, source) => {
        for (const [, name] of rewritten.matchAll(ASSIGNED)) {
            if (scoped(name) === null) continue;

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

    // What an attribute's value compiles to, by its name and the tag it is on.
    // One place, for both spellings: `onclick={onclick}` and `{onclick}` are
    // one attribute, and the shorthand had a decision of its own that knew only
    // the truth-read wrappers, so a handler, a callback prop and a None crossed
    // raw when written the short way.
    const attributeValue = (name, inner) => {
        if (HANDLER.test(name)) {
            // A handler is the one place a template expression is allowed to
            // write: it runs on an event, not during a render, where Svelte
            // rejects a write to state, and rightly so.
            const rewritten = walrus(inner);

            refuseMarkupWalrus(rewritten, inner);

            // On an element it is a DOM handler, whose return nobody reads. On
            // a component it is a prop like any other, a callback the child may
            // well read the answer of, so it crosses as every prop does: one
            // published function, its result converted, sync or awaited. It
            // still writes, since the child calls it on an event.
            // The adapting call is not the author's: written as one only when
            // the author's own expression is one, so Svelte warns about None
            // where it warns about `undefined`, after `save()` and not after a
            // name holding an optional handler. `?? undefined` is a form
            // Svelte reads as no call, and changes no value.
            if (heldChild() !== null) return `{${forChild(call(rewritten, '__bound', inner, 'child'))}}`;
            if (isComponent(tag)) return `{${call(rewritten, '__bound', inner, toPythonChild() ? 'child' : '')}}`;

            const adapted = `${EVENT_WRAPPER}(${call(rewritten, '', inner)})`;

            return calledAtTop(inner) ? `{${adapted}}` : `{${adapted} ?? undefined}`;
        }

        if (CLASS_DIRECTIVE.test(name)) return `{${call(inner, '__truthy')}}`;

        // `class`, which Svelte hands to `clsx`, and the boolean attributes,
        // which the DOM reads for truth: both read Python's truth instead.
        if (wrapperFor(name, tag)) return `{${call(inner, wrapperFor(name, tag))}}`;

        // `href={website}` with nothing to show: None goes out as undefined so
        // Svelte drops the attribute rather than writing the word "None" into
        // it. In a template the default failure is absence. The same wrapper
        // the bindings use: the boundary is the same one, and a prop passed to a
        // child is read back as None on the other side regardless.
        //
        // A `value` is what a binding compares by identity, an `<option>`
        // against its `<select>`, so a container keeps its own, and a scalar
        // is still compared by value. The `value` of a control a `bind:group`
        // binds is read by the group alone, which compares it as Python does
        // (`choice`).
        //
        if (heldChild() !== null) {
            return `{${forChild(call(inner, '__bound', undefined, 'child'), name === 'value' ? 'scalar' : '')}}`;
        }

        const grouped = !isComponent(tag) && tag !== null && tagNames(markup, tag.start).has('bind:group');
        const kind = toPythonChild() ? 'child' : name !== 'value' ? '' : grouped ? 'choice' : 'scalar';

        return `{${call(inner, '__bound', undefined, kind)}}`;
    };

    const refuseLet = (name) => {
        throw refuse(
            new SyntaxError(
                `svelthon — \`${name}\` is Svelte 4 slot syntax${said()}, which ` +
                    `\`{#snippet}\` replaced. It takes a binding pattern rather than a ` +
                    `value, so there is nothing here to read as Python: pass a snippet ` +
                    `to the component instead.`
            )
        );
    };

    while (index < markup.length) {
        const char = markup[index];

        if (inTag) {
            // The `this` of a `<svelte:component>` that holds its child: read
            // once already, where the child was bound.
            if (tag?.held !== undefined && tag.thisFrom === index) {
                const named = tagText().match(ATTRIBUTE_NAME);

                if (named) cut(named[0].length);
                index = tag.thisTo + 1;
                continue;
            }

            if (quote) {
                // `class="badge {statut.lower()}"`, an interpolation inside a
                // quoted attribute value. Svelte concatenates it into a string,
                // so it renders like any other text and goes through __text.
                // A lone one, `data="{value}"`, is the value itself, as Svelte
                // reads it, and compiles as the bare spelling does, between the
                // author's quotes: Svelte warns about those on a component as
                // it does about its own.
                if (char === '{') {
                    const end = closingBrace(markup, index);

                    const named = quotedAttribute || '';

                    if (end !== -1 && !DIRECTIVE.test(named) && !HANDLER.test(named)) {
                        region = { start: index + 1, end };

                        const written = markup.slice(index + 1, end).trim();

                        if (SPREAD(written)) throw refuse(spreadOutOfPlace(written, said(), named));

                        const inner = markup.slice(index + 1, end);

                        out += quotedLone ? attributeValue(named, inner) : `{${call(inner, '__text')}}`;
                        region = null;
                        index = end + 1;
                        continue;
                    }
                }

                if (char === quote) quote = null;
            } else if (ATTRIBUTE_START.test(markup[index - 1]) && headAt(index)) {
                // A directive that names a function: `use:`, a transition or
                // `animate:`. Its head is a Python expression like any other
                // and so is its value, so both are compiled where they are
                // written and handed to the runtime's adapter, which Svelte
                // calls by a name that always exists. See `directiveAction`.
                DIRECTIVE_HEAD.lastIndex = index;
                const [whole, kind, head, modifiers] = DIRECTIVE_HEAD.exec(markup);
                const after = index + whole.length;

                // The value: braced, or one interpolation between quotes, with
                // any whitespace around the `=`, as HTML allows and Svelte reads
                // it. A value in no form Svelte takes for a directive is left as
                // written, for Svelte to refuse.
                let value = null;
                let next = after;
                let at = after;

                while (/\s/.test(markup[at] ?? '')) at += 1;

                if (markup[at] === '=') {
                    at += 1;
                    while (/\s/.test(markup[at] ?? '')) at += 1;

                    if (markup[at] === '{') {
                        const end = closingBrace(markup, at);

                        if (end !== -1) {
                            value = { start: at + 1, end };
                            next = end + 1;
                        }
                    } else if (markup[at] === '"' || markup[at] === "'") {
                        const end = loneInterpolation(markup, at, closingBrace);

                        if (end !== -1) {
                            value = { start: at + 2, end: end - 1 };
                            next = end + 1;
                        }
                    }

                    if (value === null) {
                        out += whole;
                        index = after;
                        continue;
                    }
                }

                region = { start: index + kind.length + 1, end: index + kind.length + 1 + head.length };
                const callee = call(head, '', undefined, 'python');

                region = value;
                const read = value === null ? '' : call(markup.slice(value.start, value.end), '', undefined, 'python');
                // An action's value is read through as Svelte reads it, where
                // Svelte watches it (`watched`): the array hides it from Svelte.
                const argument = value === null ? '' : kind === 'use' ? `, __pybridge.watched(${read})` : `, ${read}`;

                region = null;
                // The head as a thunk: read by the adapter when the directive is
                // installed, and so no dependency of the value Svelte watches.
                out += `${kind}:${DIRECTIVE_ADAPTER[kind]}${modifiers}={[${JSON.stringify(head)}, () => ${callee}${argument}]}`;
                index = next;
                continue;
            } else if (index === unquoted) {
                // The closing quote of a directive whose opening one was
                // dropped: the value between them has already been written in
                // its bare form.
                unquoted = -1;
                index += 1;
                continue;
            } else if (char === '"' || char === "'") {
                const named = (tagText().match(ATTRIBUTE_NAME) || [])[1] || '';
                // A lone interpolation between quotes is the value itself, as
                // Svelte reads it. A directive, an attribute whose value is read
                // for truth, and the `value` of a group's control, which the
                // group reads typed off the field, drop their quotes for the
                // bare branch; any other attribute keeps them.
                const grouped = named === 'value' && tag !== null && tagNames(markup, tag.start).has('bind:group');
                const lone = loneInterpolation(markup, index, closingBrace);

                if (lone !== -1 && (directive(named) || wrapperFor(named, tag) || grouped)) {
                    unquoted = lone;
                    index += 1;
                    continue;
                }

                quote = char;
                quotedAttribute = named;
                quotedLone = lone !== -1;
            } else if (char === '{') {
                const end = closingBrace(markup, index);
                if (end === -1 && swallowed(markup, index)) {
                    region = { start: index + 1, end: index + 1 };
                    throw refuse(swallowedBrace(said()));
                }
                if (end !== -1) {
                    // `<svelte:options>` is read by Svelte's compiler rather
                    // than rendered, and its values have to be literals in
                    // Svelte's own grammar. They are configuration, not
                    // expressions, so they cross untouched, `customElement={{…}}`
                    // included, which is how shadow mode and props are
                    // configured.
                    if (tag !== null && tag.name === 'svelte:options') {
                        out += markup.slice(index, end + 1);
                        index = end + 1;
                        continue;
                    }

                    const attribute = tagText().match(ATTRIBUTE_NAME);
                    const glued = attribute ? null : tagText().match(UNQUOTED_VALUE);
                    const inner = markup.slice(index + 1, end);
                    const trimmed = inner.trim();
                    const attached = keyword(trimmed, '@');
                    const emitted = out.length;

                    region = { start: index + 1, end };

                    if (attribute) {
                        if (LET_DIRECTIVE.test(attribute[1])) refuseLet(attribute[1]);

                        if (SPREAD(trimmed)) {
                            throw refuse(spreadOutOfPlace(trimmed, said(), attribute[1]));
                        }

                        // A binding becomes a read/write pair; `bind:group` is
                        // the one Svelte will not take a pair for and keeps its
                        // text. A handler is Python, and what it yields is made
                        // callable from JavaScript. Everything else, a
                        // component prop included, is Python.
                        if (GROUP_DIRECTIVE.test(attribute[1]) && !isComponent(tag)) {
                            // On an element only: see `COMPONENT`. `type` is read
                            // off the node at run time, and `value` off the tag,
                            // which is the one attribute this rule looks at.
                            cut(attribute[0].length);
                            out += groupAction(inner);
                        } else if (GROUP_DIRECTIVE.test(attribute[1])) {
                            out += `{${componentGroup(trimmed)}}`;
                        } else if (DIRECTIVE.test(attribute[1])) {
                            const shaped = spreadSelect(attribute[1], inner);

                            if (shaped !== null) {
                                cut(attribute[0].length);
                                out += `${shaped.action} ${attribute[1]}=`;
                            }
                            out += `{${boundPair(attribute[1], inner)}}`;
                        } else {
                            out += attributeValue(attribute[1], inner);
                        }
                    } else if (glued) {
                        // `style:color=red{variable}`: an unquoted value with an
                        // interpolation glued onto it, which Svelte reads as text
                        // followed by an expression. The brace does not open an
                        // attribute of its own: read as the shorthand below, the
                        // text before it would become a name nobody wrote,
                        // `redvariable={…}`.
                        out += directive(glued[1])
                            ? markup.slice(index, end + 1)
                            : `{${call(inner, '__text')}}`;
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
                        // On an element, each key is read by its name as the
                        // attribute it becomes, the `value` of a control a
                        // `bind:group` binds as the group reads it. On a child
                        // written in Python, each value is handed over as a
                        // prop written by name is, the Python value itself.
                        const spreadWrapper = !onElement(tag)
                            ? '__spread'
                            : tagNames(markup, tag.start).has('bind:group')
                              ? '__spreadChoice'
                              : '__spreadElement';

                        out +=
                            heldChild() !== null
                                ? `{...${forChild(call(trimmed.slice(2), '', undefined, 'python'), 'spread')}}`
                                : toPythonChild()
                                  ? `{...${call(trimmed.slice(2), '__spreadPython', undefined, 'python')}}`
                                  : `{...${call(trimmed.slice(2), spreadWrapper)}}`;
                    } else if (trimmed.startsWith('...')) {
                        throw refuse(
                            new SyntaxError(
                                `svelthon — a spread is written \`{**${trimmed.slice(3).trim()}}\`` +
                                    `${said()}, the way Python spreads a mapping. \`...\` is ` +
                                    `Python's Ellipsis, not a spread, and it keeps that meaning ` +
                                    `everywhere an expression is read.`
                            )
                        );
                    } else if (attached?.name === 'attach' && attached.rest !== '') {
                        // `{@attach fn}` sits inside the tag rather than around
                        // it, so it is read here. What it holds is Python like
                        // every other expression, and what that yields is a
                        // function Svelte calls with the element, so it goes
                        // through the same wrapper a handler does, which trims
                        // the call to the declared arity, converts the element,
                        // and hands the teardown back.
                        out += `{@attach ${ATTACH_WRAPPER}(${call(attached.rest, '')})}`;
                    } else if (SHORTHAND_ATTRIBUTE.test(trimmed)) {
                        // {name}, Svelte's shorthand for name={name}. Expanding
                        // it is what routes the read through the namespace, and
                        // therefore through the accessor; and it is expanded
                        // into exactly what the long spelling compiles to, so
                        // the two cannot route a handler, a callback prop or a
                        // None differently.
                        out += `${trimmed}=${attributeValue(trimmed, trimmed)}`;
                    } else if (trimmed.startsWith('@')) {
                        throw refuse(unknownTag(trimmed, 'tag', ATTACHMENTS, said()));
                    } else {
                        out += markup.slice(index, end + 1);
                    }

                    keepLines(emitted, index, end);
                    region = null;
                    index = end + 1;
                    continue;
                }
            } else if (char === '>') {
                inTag = false;

                // An element's body is a scope of its own: Svelte
                // emits `const row = …` inside a JavaScript block for a snippet
                // written in a `<div>` as much as in a `<Card>`, so the name
                // dies at the closing tag. Seeding it any wider would replace a
                // Python NameError with a JavaScript ReferenceError, which is
                // the same failure with a worse message.
                // A void element has no body, and the list is HTML's: `<Input>`
                // is a component, with a body, and its closing tag pops a scope
                // its opening must have pushed.
                const selfClosing = markup[index - 1] === '/';

                if (tag && tag.closing) closeElement(tag.name);
                else if (tag && (isComponent(tag) || !VOID.has(tag.name.toLowerCase())) && !selfClosing) {
                    push([]);
                    chain.own(tag.name);
                    if (tag.wrapped) heldOwners.set(chain.id(), tag.held);
                }

                if (tag?.wrapped && (tag.closing || selfClosing)) ending = '{/each}';
                ended = true;
            }

            // `bind:value` on its own ends here, at a space, a slash or the
            // closing bracket, so this is where the name is complete and the
            // absence of an `=` is certain. Outside a quoted value only: the
            // words of `value="a bind:foo b"` are text.
            if (quote === null && /[\s/>]/.test(char)) {
                const bare = (tagText().match(BARE_ATTRIBUTE) || [])[1];

                if (bare !== undefined && LET_DIRECTIVE.test(bare)) refuseLet(bare);

                const short = tagText().match(SHORTHAND);
                if (short && short[2] !== 'bind') {
                    out += `=${attributeValue(short[1], short[3])}`;
                } else if (short) {
                    // `bind:value|important` too, whose modifier Svelte reads
                    // past: left as written, Svelte bound its own `let`.
                    const name = short[3];
                    const written = short[0];

                    // The same test the long form makes, against the same
                    // pattern: `bind:group` refuses the pair for the reason
                    // written above `GROUP_DIRECTIVE`, in both its spellings.
                    if (GROUP_DIRECTIVE.test(short[1]) && !isComponent(tag)) {
                        cut(written.length);
                        out += groupAction(name);
                    } else if (GROUP_DIRECTIVE.test(short[1])) {
                        out += `={${componentGroup(name)}}`;
                    } else {
                        const shaped = spreadSelect(short[1], name);

                        if (shaped !== null) {
                            cut(written.length);
                            out += `${shaped.action} ${written}`;
                        }
                        out += `={${boundPair(short[1], name)}}`;
                    }
                }
            }

            // The tag ends only now, its last shorthand having been read
            // against it.
            if (ended) tag = null;

            out += char + ending;
            ended = false;
            ending = '';
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

            TAG_OPEN.lastIndex = index;
            const named = TAG_OPEN.exec(markup);

            // `start` is where the group action reads the tag's `value` from,
            // which is the only rule that looks at an attribute other than its
            // own, and may find it on either side of the binding.
            tag = named ? { closing: named[1] === '/', name: named[2], start: index } : null;

            if (tag && !tag.closing && chain.closes(tag.name)) pop();

            inTag = true;
            tagIn = index;

            // A tag that holds its child is read once, in a block of one
            // iteration, and named by that iteration's item, closing tag
            // included.
            if (tag?.closing) {
                const held = heldOwners.get(chain.openedBy(tag.name));

                if (held !== undefined) {
                    tag.held = held;
                    tag.wrapped = true;
                    out += `</${held}`;
                    index += named[0].length;
                    continue;
                }
            } else if (tag) {
                const source = heldSource(tag);

                if (source !== null && !source.wrap) tag.held = source.read;
                else if (source !== null) {
                    tag.held = heldTag();
                    tag.wrapped = true;
                    out += `{#each [${source.read}] as ${tag.held}}<${tag.held}`;
                    index += named[0].length;
                    continue;
                }
            }

            out += char;
            index++;
            continue;
        }

        if (char !== '{') {
            out += char;
            index++;
            continue;
        }

        // Moved past what a `{@debug}` takes with it, the whitespace after it.
        let end = closingBrace(markup, index);
        if (end === -1) {
            if (swallowed(markup, index)) {
                region = { start: index + 1, end: index + 1 };
                throw refuse(swallowedBrace(said()));
            }

            out += char;
            index++;
            continue;
        }

        const inner = markup.slice(index + 1, end);
        const opened = inner.trim();
        // A block's head and a tag are Python after their sign, comments
        // included, and what is left of them goes into the markup Svelte
        // reads (`{@render f(x)}` keeps its tail): a comment there has to go
        // first. Only after the sign, which for a block is itself a `#`.
        const trimmed = /^[#:@]/.test(opened) ? opened[0] + uncomment(opened.slice(1)).trim() : opened;
        const emitted = out.length;

        region = { start: index + 1, end };

        if (trimmed.startsWith('#')) {
            // Every block holds an expression, so a keyword with nothing after
            // it is not one: `{#if}` is refused by the sentence below, as it
            // was when the gate was a literal space.
            const opened = keyword(trimmed, '#');
            const opens = (name) => opened !== null && opened.name === name && opened.rest !== '';

            // The expression that opens a block is read where the block stands,
            // so it is compiled before the block's scope opens: a snippet of
            // the body, preloaded into that scope, is not a name the head sees.
            if (opens('if')) {
                const condition = call(opened.rest, '__truthy');

                push([]);
                out += `{#if ${condition}}`;
            } else if (opens('each')) {
                // The block's scope, known once its names are declared.
                let id;
                const declare = (names, generated, costly) => {
                    push(names, generated);
                    computing(costly);
                    id = chain.id();
                };

                out += eachBlock(trimmed, declare, call, refusePattern, {
                    rows: () => `${EACH_ROWS}${id}`,
                    index: (keyed) => (keyed || indexed.has(id) ? `${EACH_INDEX}${id}` : null),
                    noted: (index, from) => chain.loop(id, { index, from })
                });
            } else if (opens('key')) {
                // Svelte re-creates the block when the value changes, by
                // identity: `__key` keeps it for a container and an instance,
                // and gives a value rebuilt each time its repr().
                const keyed = call(opened.rest, '__key');

                push([]);
                out += `{#key ${keyed}}`;
            } else if (opens('await')) {
                // The awaited expression is Python like any other, a coroutine
                // included, since the wrapper hands one back as a promise. What
                // follows it is a name the block declares, never an expression:
                // `{#await f() then row}`, or no name at all, `{#await f()
                // then}`, as Svelte takes it. The split is made at depth zero so
                // that `{#await f("then")}` is not cut inside its own string,
                // and only where what comes before is a whole expression, as
                // Svelte's own parser reads the longest one it can: `then` is a
                // name, and `{#await choice if then else other}` holds no
                // clause.
                const rest = opened.rest;
                const at = atTopLevel(
                    rest,
                    (i) => /^\s(?:then|catch)(?:\s|$)/.test(rest.slice(i)) && targetTree(rest.slice(0, i)) !== null
                );
                const awaited = at === -1 ? rest : rest.slice(0, at);
                const tail = at === -1 ? null : rest.slice(at).match(/^\s*(then|catch)(?:\s+([\s\S]*))?$/);

                // The promise is evaluated outside the block, so it is compiled
                // before the block's names exist: `{#await f(value) then value}`
                // reads the outer one. What `then` or `catch` receives is a
                // declaration like any other, a pattern with its defaults, and
                // the value is Python's own, as the block's names are read by
                // Python: a coroutine is still handed over as a promise, and
                // what it returns, a `Price` or the list itself, is not made
                // JavaScript's on the way.
                const promise = call(awaited, '', undefined, 'python');

                if (tail === null || !tail[2]?.trim()) {
                    push([]);
                    out += `{#await ${promise}${tail === null ? '' : ` ${tail[1]}`}}`;
                } else {
                    const opening = (names, generated, costly) => {
                        push(names, generated);
                        computing(costly);
                    };
                    const { pattern, consts } = destructured(tail[2], opening, call, false, refusePattern);

                    out += `{#await ${promise} ${tail[1]} ${pattern}}${consts}`;
                }
            } else if (opens('snippet')) {
                // A snippet declares names and holds no expression of its own:
                // it is passed through, and its body is walked like any other.
                //
                // Two scopes are touched, not one. Its parameters go into the
                // block, its own name into what encloses the block, and that name
                // outlives the block, which is the whole point of being able to
                // hand it to a child.
                const declares = trimmed.match(new RegExp(`^#snippet\\s+(${NAME})`, 'u'));

                if (declares) refuseCompilerName([declares[1]]);

                if (record && declares) {
                    const holder = chain.id();
                    record.set(holder, [...(record.get(holder) || []), pythonName(declares[1])]);
                }

                // **A parameter may carry a default, and a default is an
                // expression**, compiled where it stands like an argument given
                // to `{@render}`: `{#snippet row(value=True)}` hands Svelte
                // Python's `True`. Svelte takes a default, and a call in one.
                // And only the name is declared: `True` is no name of the
                // block.
                //
                // `push` goes *into* the function rather than after it, because
                // a default reads the parameters beside it: `(j, k = j)` is
                // ordinary JavaScript and Svelte compiles it as one.
                out += `{#snippet ${snippetParameters(
                    trimmed,
                    (names, aliases, costly) => {
                        push(names, aliases);
                        parameters([...names, ...aliases]);
                        computing(costly);
                    },
                    call,
                    refusePattern,
                    `${SNIPPET_FRAME}${snippetCount++}`
                )}`;
            } else {
                throw refuse(unknownTag(trimmed, 'block', BLOCKS, said()));
            }
        } else if (trimmed.startsWith('/')) {
            pop();
            out += markup.slice(index, end + 1);
        } else if (trimmed.startsWith(':')) {
            const clause = keyword(trimmed, ':');

            // **A clause opens a branch, and a branch sees nothing of its
            // sibling.** The `row` of `{#each rows as row}` does not exist in
            // its `{:else}`, nor a declaration or a snippet written in the
            // `{#if}` branch in the `{:else}` one, so a script name of the same
            // spelling is the one read there.
            //
            // So the branch gets an id of its own, which is what the snippets
            // of the first pass are recorded under, and a scope holding those
            // and the names its clause binds.
            branch();

            const rebind = (names, generated = [], costly = []) => {
                declare(names, generated);
                computing(costly);
            };

            const elseIf = /^:else\s+if\s/.test(trimmed);
            const condition = elseIf ? call(trimmed.replace(/^:else\s+if\s/, ''), '__truthy') : null;

            seeded();

            if (elseIf) {
                out += `{:else if ${condition}}`;
            } else if (clause !== null && ['then', 'catch'].includes(clause.name) && clause.rest.trim()) {
                const { pattern, consts } = destructured(clause.rest, rebind, call, false, refusePattern);

                out += `{:${clause.name} ${pattern}}${consts}`;
            } else if (clause !== null && CLAUSES.includes(clause.name)) {
                // `:else`, and `:then` or `:catch` that name nothing.
                out += markup.slice(index, end + 1);
            } else {
                throw refuse(unknownTag(trimmed, 'clause', CLAUSES, said()));
            }
        } else if (trimmed.startsWith('@')) {
            const written = keyword(trimmed, '@');
            const holds = (name) => written !== null && written.name === name && written.rest !== '';

            if (holds('html')) {
                out += `{@html ${call(written.rest, '__text')}}`;
            } else if (holds('render')) {
                // The snippet itself is a JavaScript function and stays one.
                // Its call is the last group of the expression (`renderedCall`),
                // and its arguments are split at depth zero, so a comma inside a
                // call or a literal stays put. Each argument is Python.
                //
                // What it is *given* depends on whose snippet it is. One a
                // Python markup declares reads its arguments as Python values.
                // Any other, a snippet a JavaScript parent gave, may be
                // JavaScript: its arguments cross as a prop's do, a float made a
                // number, None made `undefined` and a callable adapted.
                //
                // Whose it is is told by its name only when the name is one of
                // this markup's snippets. Anything else, `children`, an alias, an
                // attribute or a key, is decided at the render by the snippet
                // itself (`__pybridge.snippet`): a parent written in Python
                // declared its own, which say so as they run. And a callee that
                // is not a bare name is a Python expression, read as Python
                // reads it: `holder.fn` is an attribute, not a JavaScript
                // property.
                const found = renderedCall(written.rest.trim());
                const head = found === null ? '' : found.head;
                const optional = /\?\.\s*$/.test(head);
                const spelled = head.replace(/\?\.\s*$/, '').trim();
                const callee = pythonName(spelled);
                const named = new RegExp(`^${SHORT_NAME}$`, 'u').test(spelled);
                const owns = [...snippets].filter((name) => chain.holds(name));
                const rendered =
                    named && owns.some((one) => sameName(one, callee))
                        ? head.replace(spelled, callee)
                        : `__pybridge.snippet(${named ? callee : call(spelled, '', undefined, 'python')}, [${owns.join(', ')}])${optional ? '?.' : ''}`;
                const given = (one) => (!one.trim() ? one : call(one, '', undefined, 'python'));

                out += found === null
                    ? markup.slice(index, end + 1)
                    : `{@render ${rendered}(${arguments_(found.args).map(given).join(', ')})}`;
            } else if (written !== null && written.name === 'debug') {
                // `{@debug}` takes names rather than an expression. The only
                // tag that stands alone, so it is the only one here that does
                // not ask for something after its keyword, and alone it is
                // Svelte's.
                //
                // Each name is read as the template reads it, by Python: as
                // Python spells it, `ﬁeld` being `field`, and through the reads
                // that follow a list or a dict changed in place, which the cell
                // under the name does not see. What Svelte's tag is handed is a
                // copy made at each read (`debugged`), so a change in place is
                // a new value to it, and it logs again, under the name the
                // author wrote: an inner block names each copy so, once.
                //
                // The names are what Svelte's grammar reads: one expression,
                // its items when it is a sequence, and each a name, grouped
                // or not, so `{@debug (rows)}` and `{@debug (a, b)}` name rows,
                // a and b.
                const names = arguments_(ungrouped(written.rest)).map(ungrouped);
                const named = [...new Set(names)];

                if (!written.rest.trim() || !names.every((one) => DECLARED_NAME.test(one))) {
                    out += debugHeld + markup.slice(index, end + 1);
                    debugHeld = '';
                } else {
                    const held = named.map(() => `${DEBUGGED}${debugCount++}`);
                    const block =
                        `{#if true}` +
                        named.map((one, at) => `{@const ${held[at]} = __pybridge.debugged(${call(one, '', undefined, 'python')})}`).join('') +
                        `{#if true}` +
                        named.map((one, at) => `{@const ${one} = ${held[at]}}`).join('') +
                        `{@debug ${names.join(', ')}}{/if}{/if}`;

                    // The block renders nothing, as the tag does, but Svelte
                    // trims the whitespace beside a tag that renders nothing
                    // and keeps the whitespace beside a block. So the block
                    // touches the next node, across the whitespace after the
                    // tag, or, at the end of what holds it, the one before,
                    // across the whitespace written: the whitespace is then
                    // where Svelte would have trimmed or kept it. A run of
                    // tags hands its blocks on to the last one, so no
                    // whitespace stands between them.
                    SPACE_AT.lastIndex = end + 1;
                    const space = SPACE_AT.exec(markup)[0];
                    const next = end + 1 + space.length;
                    const closes =
                        next >= markup.length || markup.startsWith('{/', next) || markup.startsWith('{:', next) || markup.startsWith('</', next);
                    const blocks = debugHeld + block;

                    debugHeld = '';

                    if (NAMED_DEBUG.test(markup.slice(next, next + 64))) {
                        out += space;
                        debugHeld = blocks;
                        end = next - 1;
                    } else if (closes) {
                        let kept = 0;
                        while (kept < out.length && /\s/.test(out[out.length - 1 - kept])) kept += 1;
                        out = out.slice(0, out.length - kept) + blocks + out.slice(out.length - kept);
                    } else {
                        out += space + blocks;
                        end = next - 1;
                    }
                }
            } else if (/^@const\s/.test(trimmed) && DECLARATION_KEYWORD.test(trimmed.slice(1))) {
                // Svelte 5's own spelling of a declaration in a block, which
                // the template rune replaces: said, rather than listed as a
                // tag nobody knows. Not a tag Svelthon takes, so not in `TAGS`.
                throw refuse(
                    new SyntaxError(
                        `svelthon — \`{${trimmed}}\` is Svelte's \`{@const}\`${said()}; ` +
                            `Svelthon writes it \`{${trimmed.slice(1).replace(DECLARATION_KEYWORD, '$2 = $3')}}\`, ` +
                            `and \`{name => expression}\` for one that follows what it reads.`
                    )
                );
            } else {
                throw refuse(unknownTag(trimmed, 'tag', TAGS, said()));
            }
        } else if (SPREAD(trimmed)) {
            throw refuse(spreadOutOfPlace(trimmed, said(), null));
        } else {
            if (DECLARATION_KEYWORD.test(trimmed)) throw refuse(declarationKeyword(trimmed, said()));

            const declared = declaration(inner);

            if (declared) {
                // Compiled before the name it declares enters scope: a
                // declaration may read the block's names and the declarations
                // before it, never itself.
                const value = call(declared.expression, '', undefined, 'python');

                // A value the block declares is followed through what is
                // inside it (`__pybridge.state`).
                out +=
                    declared.rune === 'state'
                        ? `{let ${declared.name} = $state.raw(__pybridge.state(${value}))}`
                        : `{const ${declared.name} = $derived(${value})}`;

                declare([declared.name]);

                // A derived runs its expression when it is read; a state cell
                // is read as it is held.
                if (declared.rune !== 'state') computing([declared.name]);

                if (declared.rune === 'state' && grouped.has(declared.name)) {
                    out += `{const ${CELL}${declared.name} = {}}`;
                    declare([], [`${CELL}${declared.name}`]);
                }
            } else {
                out += `{${call(inner, '__text')}}`;
            }
        }

        keepLines(emitted, index, end);
        region = null;
        index = end + 1;
    }

    return edited();
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

// A component's `<script module>` block, found the way every other block in
// this file is found. What it *declares* is a JavaScript question and is
// answered in svelthon.js, where Svelte's own parser is at hand: see
// `moduleImports` there.

// The markup with its comments taken out, for every reading done on its text. A
// block or a declaration quoted inside `<!-- -->` is documentation: a
// `<script lang="python">` there turned a JavaScript component's expressions
// into Python, a `<script module>` there hid the real one's imports. Replaced by
// blanks rather than removed, so every offset still counts on the same string.
// A comment is one only in the markup: inside a `<script>`, a `<style>` or an
// expression, `'<!--'` is the author's text, and is left as written.
export const withoutComments = (content) => blanked(content, componentParts(content).comments.map(span));

// `content` with each of `spans`, in order, blanked.
const blanked = (content, spans) => {
    let out = '';
    let cut = 0;

    for (const [from, to] of spans) {
        out += content.slice(cut, from) + blank(content.slice(from, to));
        cut = to;
    }

    return out + content.slice(cut);
};

const span = (one) => [one.index, one.index + one.text.length];

// The markup alone, for a reading of what only the markup holds: an option, a
// directive. The comments go, and so do the bodies of scripts and styles, whose
// `'<svelte:options …>'` is a string, blanked like the rest so offsets hold.
//
// And a tag quoted in an attribute or an expression, `title='<svelte:options …>'`,
// is text: a quoted string holding a `<`, inside a tag or a `{…}`, is blanked.
// A real option's value never holds one.
const blank = (text) => text.replace(/[^\n]/g, ' ');
const QUOTED_TAG = /"[^"]*<[^"]*"|'[^']*<[^']*'/g;

// Each script's and style's body blanked, its tags kept as written.
export const blankBodies = (content) => blanked(content, componentParts(content).blocks.map((one) => one.body));

// Every expression's content blanked, its braces kept, found as Svelte finds
// it: a `{` opens one wherever it stands, and its end is the brace that closes
// it, strings and nested braces stepped over (`closingBrace`). A tag spelled in
// a template literal, `` {`<svelte:options customElement="x" />`} ``, or in an
// expression holding a dict, is text, where the walk below read it as a tag:
// the component was compiled as a custom element and its props made bindable.
const blankExpressions = (text) => {
    let out = '';
    let at = 0;

    for (let open = text.indexOf('{'); open !== -1; open = text.indexOf('{', at)) {
        const close = closingBrace(text, open);

        if (close === -1) break;

        out += text.slice(at, open + 1) + blank(text.slice(open + 1, close)) + '}';
        at = close + 1;
    }

    return out + text.slice(at);
};

export const markupOnly = (content) =>
    blankExpressions(blankBodies(withoutComments(content)))
        .replace(
            /<\p{ID_Start}[^\s/>]*(?:\s+[^\s=/>"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|\{[^{}]*\}|[^\s>"']+))?)*\s*\/?>|\{[^{}]*\}/gu,
            (found) => found.replace(QUOTED_TAG, blank)
        );

// Found among the component's own blocks, as the Python block is: a `<script
// module>` quoted in a stylesheet, an expression or a comment is not the module.
const declaresModule = (text) => {
    const attributes = attributesOf(text);
    return attributes.has('module') || attributes.get('context') === 'module';
};

// The whole element, attributes included: `lang="ts"` says how its content
// parses.
export function moduleScript(content) {
    return componentScript(content, declaresModule)?.text ?? null;
}

// Where the body of the `<script module>` begins, past its tag's `>`, or -1.
export function moduleScriptStart(content) {
    return componentScript(content, declaresModule)?.body[0] ?? -1;
}



// The hidden Python functions a template needs, one per distinct expression.
// Appended to the component's own Python, never prepended, so the author's line
// numbers stay true.
//
// `lines`, when given, receives the file line each function stands for, in the
// same order as `defs`: an error raised inside one is reported at the markup
// that wrote it. An expression written twice is two functions, one per place,
// since a function shared by two places can report only one of them: the
// second `{1 / divisor}` failing was reported at the first, never run.
// `lines` and `columns` receive, per function, where its expression is written
// in the file: the table an error is placed with, at compile time and at run
// time.
export function collector(defs, lines, columns) {
    const seen = new Map();

    return (written, wrapper, args, assign = false, line, kind = '', column, late = false) => {
        // Every expression the template holds comes through here, read or
        // written, so this is where a Python comment leaves it: once, for all
        // of them. What is left is the code, and a comment has nothing to say
        // to an assignment or to a closing parenthesis.
        const expression = uncomment(written).trim();
        // In the template the expression sits between braces, where Python
        // lets it run over several lines. Both functions below hold it between
        // parentheses, which give that back and change nothing else, a target
        // included.
        const key = `${assign ? 'set' : kind || 'get'}|${late}|${wrapper}|${args.join(',')}|${line}:${column}|${expression}`;
        if (seen.has(key)) return seen.get(key);

        // Every kind keeps the `__expr_` prefix: it is what makes the generated
        // wrapper evaluate them the way a template expression is evaluated. The
        // part after it is what the compiler reads the kind from: `lazy_` and
        // `py_`, whose value stays Python, and `child_`, a prop a Python child
        // is handed, its Python value with None the absence it is to Svelte.
        // And a `_late` at its end, whose parameters arrive as functions and
        // are read by a call (`call`).
        const infix = assign
            ? 'set_'
            : kind === 'lazy'
              ? 'lazy_'
              : kind === 'python'
                ? 'py_'
                : kind === 'scalar' || kind === 'selection' || kind === 'choice' || kind === 'child'
                  ? `${kind}_`
                  : '';
        const name = `__expr_${infix}${defs.length}${late ? '_late' : ''}`;
        seen.set(key, name);
        lines?.push(line);
        columns?.push(column);

        if (assign) {
            // A module name assigned inside a function is local unless declared
            // by Python's rule, and the binding would otherwise write into a
            // frame nobody reads. A block's own name is already a parameter.
            // `(amount)` is the name `amount`, parentheses being grouping alone.
            const named = bareName(expression);
            const bare = named !== null && !args.some((one) => pythonName(one) === named);

            defs.push(
                [
                    `def ${name}(${[BOUND_VALUE, ...args].join(', ')}):`,
                    ...(bare ? [`    global ${named}`] : []),
                    `    (${expression}) = ${BOUND_VALUE}`
                ].join('\n')
            );
        } else {
            // A comma at the top level gets its own parentheses inside the
            // wrapper's: `{a, b}` is the tuple Python reads, one argument and
            // not two.
            const held = wrapper && atTopLevel(expression, (i) => expression[i] === ',') !== -1;

            defs.push(
                `def ${name}(${args.join(', ')}):\n    return ${wrapper || ''}(${held ? `(${expression})` : expression})`
            );
        }

        return name;
    };
}

// Whether the brace at `at` found no end because a Python comment on its line
// took the closing one with it: `{name  # the name}`. A comment runs to the end
// of its line.
function swallowed(markup, at) {
    const newline = markup.indexOf('\n', at);
    const line = markup.slice(at + 1, newline === -1 ? markup.length : newline);

    for (let i = 0; i < line.length; i++) {
        if (line[i] === '#') return line.includes('}', i);

        const step = atomic(line, i);
        if (step > 0) i += step - 1;
    }

    return false;
}

const swallowedBrace = (at) =>
    new SyntaxError(
        `svelthon — a Python comment runs to the end of its line, and this one takes ` +
            `the closing \`}\` with it${at}; put the \`}\` on the next line.`
    );

// The text without its Python comments, strings left whole.
function uncomment(text) {
    return replaceLiterals(text, (literal) => (literal[0] === '#' ? '' : literal));
}

