// The markup half of the preprocessor: turning a Svelte template's expressions
// into Python. Pure string work, and deliberately free of any Node import: the
// browser playground compiles components client-side and needs exactly this,
// while the file next door needs `fs` and `path` and cannot be loaded there.
import { parse } from 'svelte/compiler';
import { attributeWrapper } from './attributes.js';
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
        // opening brace of *this* block can carry one — a `{` further in belongs
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
// the rest of a name — not `\w`, which is ASCII. `énot` is a perfectly good
// Python name ending in four letters that spell a keyword: with an ASCII
// boundary, `é` would end the word before it and `énot(x := 1)` would read as a
// grouping. The class is a constant, and the three readers share it.
const KEYWORD_BEFORE = new RegExp(
    `(^|[^${NAME_CHAR}.])(not|and|or|if|else|in|is|return|yield|lambda|await|assert|` +
        `del|elif|while|for|from|import|raise|with|as|None|True|False)$`,
    'u'
);

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
    let text = expression.trim();

    while (text.startsWith('(') && closingPair(text, 0) === text.length - 1) text = text.slice(1, -1).trim();

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

    while (index < expression.length) {
        const skip = atomic(expression, index);

        if (skip > 0) {
            out += expression.slice(index, index + skip);
            index += skip;
            continue;
        }

        const char = expression[index];

        // Only a *grouping* parenthesis, which is the form Python's grammar
        // forces in a lambda. One that opens a call belongs to the callee, and
        // consuming it rewrote `f(x := 1)` as `f__assign("x", 1)`, a call to a
        // name that does not exist, so the handler did nothing at all and said
        // nothing either. `f((x := 1))` is the form that assigns.
        //
        // The space is why this is two lines rather than one. `f (x := 1)` is a
        // call in Python, and reading only the last character took the space for
        // "nothing callable here" and rewrote the line into `f __assign(…)`, a
        // syntax error on a line the author never wrote. And `not (x := 1)` is
        // the opposite case: a word before the space, and still a grouping,
        // because `not` cannot be called. So the trailing whitespace is skipped
        // and the word that remains is checked against the keywords.
        // The end of a name is read with the same Unicode classes as `NAME` a
        // few hundred lines up, and not with `\w`: `café(x := 1)` ends on a
        // letter `\w` does not know, so the call was taken for a grouping and
        // the handler was rewritten into `café__assign("x", 1)` — a name that
        // does not exist, an error event at the click, and a page that never
        // changed. `cafe` beside it worked.
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
//
// `\s*` before the closing `>`, because HTML allows it there and Svelte parses
// it. Without it `</script >` did not close anything: the block stayed open, its
// body was read as markup, and the word above — catastrophic — is what happened.
// A CSS rule lost its declaration, a JavaScript object literal became a call,
// and a Python block closed that way was never handed to the script hook at all,
// so the component failed with `n is not defined`, naming nothing.
export function overMarkup(content, transform) {
    let out = '';
    let cut = 0;
    let block;

    for (const found = blocks(); (block = found.exec(content)); ) {
        out += transform(content.slice(cut, block.index), cut) + block[0];
        cut = block.index + block[0].length;
    }

    return out + transform(content.slice(cut), cut);
}

// The blocks a component actually has: name, attributes, closing tag. A fresh
// regex per call, because `lastIndex` on a shared `/g` is state and two walks of
// one file would resume in each other's middle. A quoted value is read whole,
// as Svelte's parser reads it, so a `>` inside one does not end the tag.
const BLOCK = /<(script|style)\b((?:[^>"']|"[^"]*"|'[^']*')*)>[\s\S]*?(<\/\1\s*>)/;
const blocks = () => new RegExp(BLOCK.source, 'gi');

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
// tag's own `>`, and how it is closed, or `null` for a file that declares none.
//
// Read from the blocks themselves, never from the text of the whole file: a
// JavaScript component holding `const example = '<script lang="python">'`, a
// string, a doc page, a code sample, declares nothing, and neither does a tag
// quoted in a `<style>` body.
export function pythonScript(content) {
    let block;

    for (const found = blocks(); (block = found.exec(content)); ) {
        if (block[1].toLowerCase() === 'script' && declaresPython(block[2])) {
            const body = block.index + `<${block[1]}${block[2]}>`.length;

            return { index: block.index, body, closing: block[3] };
        }
    }

    return null;
}

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
// long form is the only one the rest of this pass has to know about. The same
// holds for `class:active` and `style:color`, whose unexpanded read is
// JavaScript's truth of the raw cell: None and `[]` are objects, so both set
// the class.
// The name a shorthand holds, `{name}` or `bind:name`: a name, or Svelte's with
// its `$`.
const SHORT_NAME = `[\\p{XID_Start}_$][${NAME_CHAR}$]*`;
const SHORTHAND = new RegExp(`\\b((bind|class|style):(${SHORT_NAME}))(\\|important)?$`, 'u');
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
// `let:item` on its own declares a name for the slot's body. Compiled as a value
// it made Svelte die inside itself on `Cannot read properties of undefined`,
// which is the outcome this pass refuses things to prevent.
const LET_DIRECTIVE = /^let:/;

// Whether an attribute name is one the ladder below has a rule for. Svelte 5
// reads `bind:value={x}` and `bind:value="{x}"` as the same thing, and its own
// fixtures write the quoted form; to this scanner they were two doors, and every
// rule lived behind one of them. A binding skipped its read/write pair, so the
// `__bound` that turns Python's None into undefined never ran and a field
// displayed the word "None"; `class:on` was read as text rather than for
// truthiness, so an empty Python list was true through the quotes and false
// without them.
//
// So the question is asked once, here, before either branch runs.

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
// its own parser fixture `attribute-with-whitespace` is that line. Without it
// nothing matched, so every rule was skipped and the value fell through to the
// shorthand expansion, which turned `title= {x}` into `title= x={…}` — not
// markup, and Svelte answered `Expected token >` about a token nobody typed.
const ATTRIBUTE_NAME = new RegExp(`(${ATTRIBUTE_CHAR}+)=\\s*$`);

// The same, to cut the name back out of what has been written.
const ATTRIBUTE_ASSIGN = new RegExp(`${ATTRIBUTE_CHAR}+=\\s*$`);

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
// — `needs_special_value_handling` in its RegularElement visitor — and ours
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

function tagValue(markup, from, name = 'value') {
    for (let at = from; at < markup.length && markup[at] !== '>'; ) {
        const char = markup[at];

        if (char !== '"' && char !== "'" && char !== '{') {
            at += 1;
            continue;
        }

        const end = valueEnd(markup, at);

        if (end === -1) return null;
        if ((markup.slice(from, at).match(ATTRIBUTE_NAME) || [])[1] === name) {
            return { start: at + 1, end, braced: char === '{' };
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
// at all — Svelte reads `bind:group={x}` there as the prop of that name — and it
// refuses `use:` outright, so the component did not compile.
const COMPONENT = /^(?:\p{Lu}|svelte:(?:component|self)\b)|\./u;

const isComponent = (tag) => tag !== null && COMPONENT.test(tag.name);

const identifiers = (text) => [...text.matchAll(new RegExp(NAME, 'gu'))].map((m) => m[0]);

// The names an expression **reads**, which is not every word in its text.
//
// `identifiers` above answers the other question — which names a *declaration*
// binds — and a pattern holds no strings and no attributes, so one regular
// expression is the whole of it there. An expression is not that: two kinds of
// word in one are not a reference, and both were being handed to `follow`.
//
//   a **string** or a comment   `greet("count")` does not read `count`
//   an **attribute**            `row.label` reads `row`; `label` is the object's
//
// Subscribing to a name an expression never reads was noise until a name could
// be in the temporal dead zone of the declaration it sits in. Then it is fatal:
// `{#each rows as [label="total", total=0]}` cannot mount, because the argument
// prepared for `total` is evaluated before `total` exists — out of a default
// that is a plain string.
//
// **An f-string is code, in its fields and nowhere else.** `f"{count} left"`
// reads `count`, so skipping the literal whole would cost the block the very
// subscription it depends on; reading all of it would count `left`. `atomic`
// says where each field's expression lies, since it is the scanner that tells a
// field from a format specification, where `#` is an option and `'` a fill
// character: `f"{value:#x}"` and `f"{value:'>4}"` read `value` and nothing else.
// A conversion, `!r`, closes the expression as well.
const CONVERSION = /![rsa]\s*$/;

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
        const target = parameterPattern(part.slice(0, at), call, names, tuple, unpack);

        return `${target}= ${call(part.slice(at + 1), '', undefined, 'lazy')}`;
    }

    // The spacing the author wrote is theirs, and only the middle is rebuilt.
    const trimmed = part.trim();
    const lead = part.slice(0, part.length - part.trimStart().length);
    const tail = part.slice(part.trimEnd().length);

    // What follows a trailing comma, `[a, b,]`: nothing to bind, and the comma
    // stays, which JavaScript reads the same way.
    if (trimmed === '') return part;

    const close = CLOSES[trimmed[0]] === undefined ? -1 : closingPair(trimmed, 0);

    // A pattern: the same question, one level down, for each of its elements.
    //
    // **And only when the group is the whole entry.** A computed key opens with
    // a bracket too — `[field.upper()]: value` — so a group with anything after
    // it is not a pattern, and reading one as a pattern took the key apart as
    // if its expression were a list of targets.
    if (close === trimmed.length - 1 && trimmed[0] === '{') {
        return `${lead}${unpackByKey(trimmed.slice(1, close), call, names, tuple, unpack)}${tail}`;
    }

    if (close === trimmed.length - 1) {
        const inside = arguments_(trimmed.slice(1, close))
            .map((one) => parameterPattern(one, call, names, tuple, unpack))
            .join(',');

        const [opened, closed] =
            tuple && trimmed[0] === '(' ? ['[', ']'] : [trimmed[0], trimmed[close]];

        return `${lead}${opened}${inside}${closed}${tail}`;
    }

    names.push(...identifiers(trimmed));

    return part;
}

// The name a row unpacked by key stands under, inside the block that unpacks it.
const UNPACKED = '__unpacked_';

// What one declaration list unpacks by key, gathered while its patterns are
// walked: the aliases standing where the braces stood, in order, and for each
// key the `{@const}` that reads it.
const unpacker = () => {
    let next = 0;

    return { alias: () => `${UNPACKED}${next++}`, aliases: [], consts: [], bound: new Set() };
};

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
// `...rest` is the dict of the keys not named, as `**rest` is in a `match`.
function unpackByKey(inside, call, names, tuple, unpack) {
    const alias = unpack.alias();
    const before = names.length;
    const keys = [];

    unpack.aliases.push(alias);

    for (const entry of arguments_(inside)) {
        const text = entry.trim();

        if (text === '') continue;

        if (text.startsWith('...')) {
            const target = text.slice(3).trim();

            unpack.consts.push({
                target,
                read: `{k: v for k, v in __getattr(${alias}, "items")() if k not in (${keys.map((one) => `${one}, `).join('')})}`,
                source: '',
                lazy: false
            });
            names.push(...identifiers(target));
            continue;
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
        const named = computed ? `(${key.slice(1, -1)})` : /^['"]/.test(key) ? key : JSON.stringify(key);

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
// it reads is read only when the default is taken.
const unpacked = (unpack, call) =>
    unpack.consts
        .map(({ target, read, source, lazy }) => `{@const ${target} = ${call(read, '', source, lazy ? 'lazy' : 'python')}}`)
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

// A comma list of patterns that a block declares: its names go to `declare`,
// which opens the block's scope, with the aliases of the rows it unpacks by key
// beside them, and the list comes back with every expression in it compiled
// inside that scope. Every construct that binds names in the markup goes
// through here: a snippet's parameters, an `{#each}` target, and the value an
// `{#await}` hands to `then` or `catch`. `consts` is what the block opens with.
const destructured = (text, declare, call, tuple) => {
    const parts = arguments_(text.trim());
    const first = unpacker();

    declare(boundBy(parts, tuple, first), first.aliases);

    const unpack = unpacker();
    const pattern = parts.map((part) => parameterPattern(part, call, [], tuple, unpack)).join(',');

    return { pattern, unpack, consts: unpacked(unpack, call) };
};

// `{#snippet row(one, value=True)}` read apart: the names go to `declare`,
// which opens the block's scope, and what comes back is the declaration
// rewritten with each default compiled as the Python expression it is. The
// split is at top level, so a comma or an `=` inside a string or a call belongs
// to the default and not to the list.
function snippetParameters(trimmed, declare, call) {
    const open = trimmed.indexOf('(');
    const head = open === -1 ? trimmed : trimmed.slice(0, open);
    const close = open === -1 ? -1 : closingPair(trimmed, open);

    const name = head.replace(/^#snippet\s*/, '').trim();

    // No parameter list, or one Svelte will refuse in its own words: nothing is
    // declared.
    if (close === -1) {
        declare([], []);

        return `${trimmed.replace(/^#snippet\s*/, '')}}`;
    }

    const { pattern, consts } = destructured(trimmed.slice(open + 1, close), declare, call, false);

    return `${name}(${pattern})${trimmed.slice(close + 1)}}${consts}`;
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

function eachBlock(trimmed, declare, call) {
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
        return `{#each ${iterable}}`;
    }

    const named = body.slice(at).replace(/^\s+as\s+/, '');
    const keyed = trailingKey(named);

    // **A target destructures, and a destructuring holds expressions**, as a
    // snippet's parameter list does, and one walk answers for both: in
    // `{#each rows as [value=True]}` the default is Python and `True` is no name
    // of the block.
    //
    // Split at the top level first, because the target is a comma list of its
    // own — `as (a, b), i` is a pattern and then Svelte's index — and each
    // entry is a pattern in its own right.
    //
    // **Three scopes, in three steps, and the order is the whole rule.** The
    // iterable is evaluated where the loop is written, so it is compiled before
    // the block's names exist: `{#each rows as rows}` reads the outer list. The
    // target's own names then open the scope — every one of them, the index
    // included, which is what `[a, b = a]` and `[f = i], i` need and what
    // `[g = h, h]` needs in order to throw where JavaScript throws. Only then
    // are the defaults compiled, and the key last, since it is evaluated inside
    // the block on each row.
    // Kept Python: Svelte only walks it, and every row goes back to Python
    // expressions. Converted, it would be a fresh list each render, its floats
    // numbers, and a row would have no identity left to key by.
    const iterable = call(body.slice(0, at), '__seq', undefined, 'python');
    const { pattern, unpack, consts } = destructured(keyed ? keyed[0] : named, declare, call, true);

    return `{#each ${iterable} as ${pattern}` + (keyed ? ` (${eachKey(keyed[1], unpack, call)})` : '') + `}${consts}`;
}

// The key of an `{#each}` is computed outside the block, from the pattern's own
// names, and a key unpacked by key is a `{@const}` of the block. So such a name
// is bound again in the key's own expression, by a comprehension over the row,
// and is not handed in from a scope the key does not see.
function eachKey(key, unpack, call) {
    if (unpack.consts.length === 0) return call(key, '__key');

    const loops = unpack.consts.map(({ target, read }) => ` for ${target} in [${read}]`).join('');

    return call(`[(${key})${loops}][0]`, '__key', key, '', [...unpack.bound]);
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

// The compiler's own prefix, written the same way `compile.cjs` writes it: a
// name that begins with `__` and does not end with one, so Python's own dunders
// — `__all__`, `__doc__` — stay free.
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
// reads Python. Left alone it fell through to the generic interpolation and
// became `__text(const a = n)`, which is not Python, so the author got Brython's
// `invalid syntax` on a line they never wrote.
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
// above the `{#snippet row(x)}` it names. One left-to-right walk cannot know a
// name it has not reached yet, so the markup is walked twice: once with a
// throwaway collector, to record which scope each snippet name belongs to, then
// for real with every scope seeded.
//
// The parameters are the other half: `x` belongs *inside* the block, the name
// belongs outside it.
// `where` is `{ filename, content, offset }`, and it is what a refusal needs to
// name a position: `markup` is one chunk of the file, `offset` is where that
// chunk starts, and `content` is the whole of it. Optional, since the playground
// and the range scan below compile a fragment that belongs to no file.
export function pythonExpressions(markup, collect, onPython, where) {
    const named = new Map();

    walk(markup, () => '__probe', undefined, new Map(), named, where);

    return walk(markup, collect, onPython, named, null, where);
}

// A tag's opening, read where the walk stands rather than on a copy of the rest
// of the markup. A name starts as an identifier does, `\p{ID_Start}`, which is
// what Svelte's component names allow: an ASCII letter left `<Étiquette>` no tag.
const TAG_OPEN = /<(\/?)\s*(\p{ID_Start}[\p{ID_Continue}$‌‍:.-]*)/uy;

function walk(markup, collect, onPython, seed, record, where) {
    let out = '';
    let index = 0;

    const headAt = (at) => {
        DIRECTIVE_HEAD.lastIndex = at;
        return DIRECTIVE_HEAD.test(markup);
    };
    let inTag = false;
    let quote = null;
    let quotedAttribute = null;
    let region = null;

    // The index of the closing quote of a directive whose quotes are being
    // dropped, so the pair is skipped rather than written out around a value the
    // bare branch is about to rewrite.
    let unquoted = -1;

    // Scopes are numbered by the order they are opened in, which two walks of
    // the same markup agree on. The base scope, the component's own, is 0.
    let opened = 0;
    const ids = [0];
    const scopes = [[...(seed.get(0) || [])]];
    const grouped = groupedNames(markup);

    // Every snippet this markup declares, wherever: the first walk recorded
    // them, scope by scope.
    const snippets = new Set([...seed.values()].flat());

    // The tag being read, so that its closing `>` knows what it closed.
    let tag = null;

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

    // `generated` are the pass's own names, the aliases of `unpackByKey`, which
    // the prefix rule does not apply to.
    const push = (names, generated = []) => {
        opened += 1;
        ids.push(opened);
        scopes.push([...(seed.get(opened) || []), ...refuseCompilerName(names), ...generated]);
    };

    // A clause of the open block: a new branch, numbered like a block so the
    // snippets the first walk recorded in it come back, and holding nothing of
    // the branch before it. Never the base scope, for the reason below.
    //
    // Two steps, because `{:else if}` reads its condition between them: where
    // the branch stands, after the previous branch has closed and before its
    // own snippets exist.
    const branch = () => {
        if (scopes.length > 1) {
            opened += 1;
            ids[ids.length - 1] = opened;
            scopes[scopes.length - 1] = [];
        }
    };

    const seeded = () => {
        if (scopes.length > 1) scopes[scopes.length - 1].push(...(seed.get(ids[ids.length - 1]) || []));
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

    // A snippet's parameter is handed over by whoever renders the snippet, a
    // JavaScript component or this markup, converted or not: it is read as
    // every value coming into Python is (`__pybridge.received`), so a callable
    // Python handed out is itself again. The innermost scope holding the name
    // says whether it is one.
    const received = (name) => {
        for (let at = scopes.length - 1; at >= 0; at--) {
            if (scopes[at].includes(name)) {
                return scopes[at].parameters?.has(name) ? `${RECEIVED}(${name})` : name;
            }
        }

        return name;
    };

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
    // scope: passed a tag-declared state the expression never mentions, Svelte
    // warns `state_referenced_locally`, since it sees the state read outside a
    // reactive position.
    //
    // It is the right shape anyway. `follow(x)` subscribes the reader to `x`,
    // and an expression that does not read `x` has no business depending on it.
    const mentioned = (expr) => {
        const names = new Set(referenced(expr));

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
    //             Each name is handed over as a function that reads it, and the
    //             compiler makes the reads calls, so a branch Python does not
    //             take reads nothing, as in Python.
    //   'scalar'  a value a binding compares by identity, a `value` or a
    //             `bind:` read: a scalar is made JavaScript's, so `0.5` twice
    //             is one value, and a container is handed over as the object it
    //             is, so an option finds its select and a group its list.
    //   'selection' the read of a `<select multiple>`'s binding: the same, item
    //             by item, for the list whose items meet the options' values.
    // `bound` names the block's names the expression binds for itself, which
    // are therefore not handed in: the key of an `{#each}`, see `eachKey`.
    const call = (expr, wrapper, source = expr, kind = '', bound = []) => {
        const trimmed = expr.trim();
        const args = mentioned(trimmed).filter((one) => !bound.includes(one));
        const lazy = kind === 'lazy';

        locate(source.trim());
        // The column of its opening brace, counted from zero: where every
        // refusal of this pass points.
        const at = position();
        const name = collect(trimmed, wrapper, args, false, at?.line, kind, at?.column);

        // follow() on the block's own names: a row of an {#each} is a plain
        // JavaScript value, not a signal, so reading `it.label` registers
        // nothing by itself. This is what subscribes the row's block to the row.
        const handed = (arg) => (lazy ? `() => ${FOLLOW}(${received(arg)})` : `${FOLLOW}(${received(arg)})`);

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
    const quotedValue = (text, quote) => {
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
        if (pieces.length === 1) return call(pieces[0].expression, '');

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
    const boundPair = (directive, expr) => {
        const multiple = directive === 'bind:value' && tag?.name === 'select' && tagNames(markup, tag.start).has('multiple');
        const crossing = multiple ? SELECTED_VALUE : BIND_VALUE;
        const target = expr.trim();
        const write = declaredHere(target) ? `${target} = ${crossing}(${BOUND_VALUE})` : assign(expr, crossing);

        return `() => ${call(expr, '__bound', undefined, multiple ? 'selection' : 'scalar')}, (${BOUND_VALUE}) => ${write}`;
    };

    const groupAction = (expr) => {
        // The Python list itself: the group compares with Python's `==`, and
        // its inputs know each other by the list they share.
        const read = call(expr, '', undefined, 'python');

        // A name the markup declared is Svelte's cell, which Svelte writes
        // itself: `assign` would hand it to a `def` as a parameter and write
        // that. The value still crosses into Python on the way.
        const target = expr.trim();
        const own = declaredHere(target);
        const write = own ? `${target} = ${BIND_VALUE}(${BOUND_VALUE})` : assign(expr);
        const found = tag === null ? null : tagValue(markup, tag.start);
        const outer = region;

        // No locate(): the attribute reports its own range where it is written,
        // and `bind:group={n} value={n}` would otherwise report the binding's
        // range a second time, the two texts being the same.
        region = null;

        const value =
            found === null
                ? 'undefined'
                : found.braced
                  ? call(markup.slice(found.start, found.end), '')
                  : quotedValue(markup.slice(found.start, found.end), markup[found.start - 1]);

        region = outer;

        // And the binding itself, as the author wrote it. The action needs to
        // know which inputs belong together. Two bindings may hold one list —
        // `left = shared`, `right = shared` — and sharing a value is not sharing
        // a binding, so the list they hold is not what identifies a group.
        //
        // And the instance, as its namespace. Two *instances* of one component
        // have the same binding text and may have been handed the same list —
        // `selected = initial`, with one empty list passed to both — so neither
        // of the two halves above tells them apart. The namespace is the thing
        // every element of one instance shares and no other instance has.
        //
        // And the template names the binding mentions, which are what tell the
        // rows of an `{#each}` apart: `row.picked` is one target per `row`.
        // The list the row holds cannot stand in for them, since two rows may
        // be handed one default list and are still two targets. A cell the
        // markup declared is its own target, told by its token.
        const where = own && inScope().includes(`${CELL}${target}`) ? [`${CELL}${target}`] : mentioned(target);

        // And `checked` for the server, which runs no action: Svelte's server
        // writes it for its own group, from the model, when the tag has a value,
        // a checkbox being one whose `type` is the static text `checkbox`. With
        // no node to read static text off, the server is handed the text. A tag
        // that writes `checked` itself is checked by it, as Svelte's is, and
        // gets no second one.
        const kind = tag === null ? null : tagValue(markup, tag.start, 'type');
        const boxes = kind !== null && !kind.braced && markup.slice(kind.start, kind.end) === 'checkbox';
        const served =
            found !== null && value === 'undefined'
                ? JSON.stringify(attributeText(markup.slice(found.start, found.end), markup[found.start - 1]))
                : value;
        const checked =
            tag !== null && tagNames(markup, tag.start).has('checked')
                ? ''
                : ` checked={__pybridge.groupChecked(() => ${read}, () => ${served}, ${boxes})}`;

        return (
            `use:${GROUP_ACTION}={[${read}, (${BOUND_VALUE}) => ${write}, ${value}, ` +
            `${JSON.stringify(expr.trim())}, ${NAMESPACE}, [${where.join(', ')}]]}${checked}`
        );
    };

    // `bind:group` on a component, where `group` is an ordinary prop and none of
    // the group machinery applies. Svelte still refuses the read/write pair
    // there — its check is on the *name* of the binding, wherever it is written,
    // and answers `bind:group can only bind to an Identifier or MemberExpression`.
    //
    // The namespace is a member expression, which it accepts, and reading or
    // writing through it goes through the same accessor the pair would have
    // called. A name the markup declared is Svelte's own and stays as it is.
    //
    // Anything else is refused rather than guessed: `__py.row.pick` would be a
    // JavaScript member access on a Python object, which finds a property and
    // not a key, so the write would land nowhere and say nothing.
    const componentGroup = (target) => {
        if (declaredHere(target)) return target;
        if (DECLARED_NAME.test(target)) return `${NAMESPACE}.${target}`;

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
    // missing is the ability to *write* a markup name from a handler, and none
    // of the 889 components of the corpus asks for it.
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
            if (isComponent(tag)) return `{${call(rewritten, '__bound', inner)}}`;

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
        // A `value` is what a binding compares by identity — an `<option>`
        // against its `<select>` — so a container keeps its own, and a scalar
        // is still compared by value.
        return `{${call(inner, '__bound', undefined, name === 'value' ? 'scalar' : '')}}`;
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
            if (quote) {
                // `class="badge {statut.lower()}"`, an interpolation inside a
                // quoted attribute value. Svelte concatenates it into a string,
                // so it renders like any other text and goes through __text.
                if (char === '{') {
                    const end = closingBrace(markup, index);

                    const named = quotedAttribute || '';

                    if (end !== -1 && !DIRECTIVE.test(named) && !HANDLER.test(named)) {
                        region = { start: index + 1, end };

                        const written = markup.slice(index + 1, end).trim();

                        if (SPREAD(written)) throw refuse(spreadOutOfPlace(written, said(), named));

                        out += `{${call(markup.slice(index + 1, end), '__text')}}`;
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
                const argument = value === null ? '' : `, ${call(markup.slice(value.start, value.end), '', undefined, 'python')}`;

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
                // Svelte reads it, for a directive and for an attribute whose
                // value is read for truth.
                const closing =
                    directive(named) || wrapperFor(named, tag) ? loneInterpolation(markup, index, closingBrace) : -1;

                if (closing !== -1) {
                    unquoted = closing;
                    index += 1;
                    continue;
                }

                quote = char;
                quotedAttribute = named;
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
                            out = out.replace(ATTRIBUTE_ASSIGN, '') + groupAction(inner);
                        } else if (GROUP_DIRECTIVE.test(attribute[1])) {
                            out += `{${componentGroup(trimmed)}}`;
                        } else if (DIRECTIVE.test(attribute[1])) {
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
                        // attribute it becomes.
                        out += `{...${call(trimmed.slice(2), onElement(tag) ? '__spreadElement' : '__spread')}}`;
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
                if (tag && tag.closing) pop();
                else if (
                    tag &&
                    (isComponent(tag) || !VOID.has(tag.name.toLowerCase())) &&
                    markup[index - 1] !== '/'
                ) {
                    push([]);
                }

                tag = null;
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
                } else if (short && short[4] === undefined) {
                    const name = short[3];

                    // The same test the long form makes, against the same
                    // pattern. `bind:group` refuses the pair for the reason
                    // written above `GROUP_DIRECTIVE`, and that rule was wired
                    // into one of its two spellings: written bare, it emitted
                    // the pair, and Svelte answered that `bind:group` can only
                    // bind to an identifier.
                    if (GROUP_DIRECTIVE.test(short[1]) && !isComponent(tag)) {
                        out = out.slice(0, out.length - short[1].length) + groupAction(name);
                    } else if (GROUP_DIRECTIVE.test(short[1])) {
                        out += `={${componentGroup(name)}}`;
                    } else {
                        out += `={${boundPair(short[1], name)}}`;
                    }
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

            TAG_OPEN.lastIndex = index;
            const named = TAG_OPEN.exec(markup);

            // `start` is where the group action reads the tag's `value` from,
            // which is the only rule that looks at an attribute other than its
            // own, and may find it on either side of the binding.
            tag = named ? { closing: named[1] === '/', name: named[2], start: index } : null;

            inTag = true;
            tagIn = index;
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
                out += eachBlock(trimmed, push, call);
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
                // `{#await f() then row}`. The split is made at depth zero so
                // that `{#await f("then")}` is not cut inside its own string.
                const rest = opened.rest;
                const at = atTopLevel(rest, (i) => /^\s(?:then|catch)\s/.test(rest.slice(i)));
                const awaited = at === -1 ? rest : rest.slice(0, at);
                const tail = at === -1 ? null : rest.slice(at).match(/^\s*(then|catch)\s+([\s\S]*)$/);

                // The promise is evaluated outside the block, so it is compiled
                // before the block's names exist: `{#await f(value) then value}`
                // reads the outer one. What `then` or `catch` receives is a
                // declaration like any other, a pattern with its defaults.
                const promise = call(awaited, '');

                if (tail === null) {
                    push([]);
                    out += `{#await ${promise}}`;
                } else {
                    const { pattern, consts } = destructured(tail[2], push, call, false);

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
                    const holder = ids[ids.length - 1];
                    record.set(holder, [...(record.get(holder) || []), declares[1]]);
                }

                // **A parameter may carry a default, and a default is an
                // expression**, compiled where it stands like an argument given
                // to `{@render}`: `{#snippet row(value=True)}` hands Svelte
                // Python's `True`. Svelte takes a default, and a call in one.
                // And only the name is declared: `True` is no name of the
                // block.
                //
                // `push` goes *into* the function rather than after it, because
                // a default reads the parameters beside it — `(j, k = j)` is
                // ordinary JavaScript and Svelte compiles it as one.
                out += `{#snippet ${snippetParameters(
                    trimmed,
                    (names, aliases) => {
                        push(names, aliases);
                        scopes[scopes.length - 1].parameters = new Set([...names, ...aliases]);
                    },
                    call
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
            // spelling is the one read there. Keeping the block's scope across
            // the clause handed the expression a JavaScript argument that did
            // not exist, and the component died at mount.
            //
            // So the branch gets an id of its own, which is what the snippets
            // of the first pass are recorded under, and a scope holding those
            // and the names its clause binds.
            branch();

            const rebind = (names, generated = []) => {
                scopes[scopes.length - 1]?.push(...refuseCompilerName(names), ...generated);
            };

            const elseIf = /^:else\s+if\s/.test(trimmed);
            const condition = elseIf ? call(trimmed.replace(/^:else\s+if\s/, ''), '__truthy') : null;

            seeded();

            if (elseIf) {
                out += `{:else if ${condition}}`;
            } else if (clause !== null && ['then', 'catch'].includes(clause.name) && clause.rest.trim()) {
                const { pattern, consts } = destructured(clause.rest, rebind, call, false);

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
                // Arguments are split at depth zero, so a comma inside a call or
                // a literal stays put.
                //
                // What it is *given* depends on whose snippet it is. One this
                // markup declares is Python, and reads its arguments as Python
                // values. Any other, a `children` or a snippet prop, comes from
                // the parent, which may be JavaScript: its arguments cross as a
                // prop's do, a float made a number, None made `undefined` and a
                // callable adapted.
                const called = written.rest.trim();
                const opens = called.indexOf('(');
                const closes = opens === -1 ? -1 : closingPair(called, opens);
                const callee = opens === -1 ? '' : called.slice(0, opens).replace(/\?\.\s*$/, '').trim();
                const ours = snippets.has(callee) && inScope().includes(callee);

                out += closes === -1
                    ? markup.slice(index, end + 1)
                    : `{@render ${called.slice(0, opens)}(${arguments_(called.slice(opens + 1, closes))
                          .map((one) =>
                              !one.trim() ? one : ours ? call(one, '', undefined, 'python') : call(one, '__bound')
                          )
                          .join(', ')})${called.slice(closes + 1)}}`;
            } else if (written !== null && written.name === 'debug') {
                // `{@debug}` takes names rather than an expression, and the
                // names it takes are the JavaScript ones the compiler emits.
                // The only tag that stands alone, so it is the only one here
                // that does not ask for something after its keyword.
                out += markup.slice(index, end + 1);
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

                out +=
                    declared.rune === 'state'
                        ? `{let ${declared.name} = $state.raw(${value})}`
                        : `{const ${declared.name} = $derived(${value})}`;

                scopes[scopes.length - 1]?.push(...refuseCompilerName([declared.name]));

                if (declared.rune === 'state' && grouped.has(declared.name)) {
                    out += `{const ${CELL}${declared.name} = {}}`;
                    scopes[scopes.length - 1]?.push(`${CELL}${declared.name}`);
                }
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

// A component's `<script module>` block, found the way every other block in
// this file is found. What it *declares* is a JavaScript question and is
// answered in svelthon.js, where Svelte's own parser is at hand: see
// `moduleImports` there.

// The markup with its comments taken out, for every reading done on its text. A
// block or a declaration quoted inside `<!-- -->` is documentation: a
// `<script lang="python">` there turned a JavaScript component's expressions
// into Python, a `<script module>` there hid the real one's imports. Replaced by
// blanks rather than removed, so every offset still counts on the same string.
// A comment is one only in the markup: inside a `<script>` or a `<style>`,
// `'<!--'` is the author's text, and is left as written.
export const withoutComments = (content) =>
    content.replace(new RegExp(`${BLOCK.source}|<!--[\\s\\S]*?-->`, 'gi'), (found, element) =>
        element === undefined ? found.replace(/[^\n]/g, ' ') : found
    );

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
export const blankBodies = (content) =>
    content.replace(blocks(), (found, name, attributes, close) => {
        const open = `<${name}${attributes}>`;

        return open + blank(found.slice(open.length, found.length - close.length)) + close;
    });

export const markupOnly = (content) =>
    blankBodies(withoutComments(content))
        .replace(
            /<\p{ID_Start}[^\s/>]*(?:\s+[^\s=/>"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|\{[^{}]*\}|[^\s>"']+))?)*\s*\/?>|\{[^{}]*\}/gu,
            (found) => found.replace(QUOTED_TAG, blank)
        );

// Found by `blocks()`, as the Python block is, which steps over a `<style>`
// whole: a `<script module>` quoted in a stylesheet is not the module.
const declaresModule = (text) => {
    const attributes = attributesOf(text);
    return attributes.has('module') || attributes.get('context') === 'module';
};

export function moduleScript(content) {
    const text = withoutComments(content);
    let block;

    for (const found = blocks(); (block = found.exec(text)); ) {
        // The whole element, attributes included: `lang="ts"` says how its
        // content parses.
        if (block[1].toLowerCase() === 'script' && declaresModule(block[2])) return block[0];
    }

    return null;
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

    return (written, wrapper, args, assign = false, line, kind = '', column) => {
        // Every expression the template holds comes through here, read or
        // written, so this is where a Python comment leaves it: once, for all
        // of them. What is left is the code, and a comment has nothing to say
        // to an assignment or to a closing parenthesis.
        const expression = uncomment(written).trim();
        // In the template the expression sits between braces, where Python
        // lets it run over several lines. Both functions below hold it between
        // parentheses, which give that back and change nothing else, a target
        // included.
        const key = `${assign ? 'set' : kind || 'get'}|${wrapper}|${args.join(',')}|${line}:${column}|${expression}`;
        if (seen.has(key)) return seen.get(key);

        // Every kind keeps the `__expr_` prefix: it is what makes the generated
        // wrapper evaluate them the way a template expression is evaluated. The
        // part after it is what the compiler reads the kind from: `lazy_`, whose
        // parameters are read by a call, and `py_`, whose value stays Python.
        const infix = assign
            ? 'set_'
            : kind === 'lazy'
              ? 'lazy_'
              : kind === 'python'
                ? 'py_'
                : kind === 'scalar' || kind === 'selection'
                  ? `${kind}_`
                  : '';
        const name = `__expr_${infix}${defs.length}`;
        seen.set(key, name);
        lines?.push(line);
        columns?.push(column);

        if (assign) {
            // A module name assigned inside a function is local unless declared
            // by Python's rule, and the binding would otherwise write into a
            // frame nobody reads. A block's own name is already a parameter.
            const bare = DECLARED_NAME.test(expression) && !args.includes(expression);

            defs.push(
                [
                    `def ${name}(${[BOUND_VALUE, ...args].join(', ')}):`,
                    ...(bare ? [`    global ${expression}`] : []),
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

